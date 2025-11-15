const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// PostgreSQL connection for analytics
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pgPool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

// Database setup
const dbPath = process.env.NODE_ENV === 'production' 
  ? '/database/flappybird.db'  // Railway volume path
  : path.join(__dirname, 'database.db');  // Local development

// Ensure database directory exists in production
if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const databaseDir = '/database';
  if (!fs.existsSync(databaseDir)) {
    console.log('Creating database directory...');
    fs.mkdirSync(databaseDir, { recursive: true });
  }
}

console.log(`Database path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    console.error('Database path was:', dbPath);
  } else {
    console.log(`Connected to SQLite database at: ${dbPath}`);
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  const createScoresTable = `
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  const createVisitorsTable = `
    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      user_agent TEXT,
      referer TEXT,
      page TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.run(createScoresTable, (err) => {
    if (err) {
      console.error('Error creating scores table:', err);
    } else {
      console.log('Scores table ready');
    }
  });
  
  db.run(createVisitorsTable, (err) => {
    if (err) {
      console.error('Error creating visitors table:', err);
    } else {
      console.log('Visitors table ready');
    }
  });
  
  // Initialize PostgreSQL analytics table
  initializePostgres();
}

// Initialize PostgreSQL analytics table
async function initializePostgres() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL found, skipping PostgreSQL analytics setup');
    return;
  }
  
  try {
    const createAnalyticsTable = `
      CREATE TABLE IF NOT EXISTS oleed_analytics (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(45) NOT NULL,
        country VARCHAR(100),
        city VARCHAR(100),
        user_agent TEXT,
        browser VARCHAR(100),
        os VARCHAR(100),
        device_type VARCHAR(50),
        referer TEXT,
        page_url TEXT,
        query_params TEXT,
        method VARCHAR(10),
        status_code INTEGER,
        session_id VARCHAR(255),
        language VARCHAR(10),
        screen_resolution VARCHAR(20),
        timezone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_analytics_ip ON oleed_analytics(ip_address);
      CREATE INDEX IF NOT EXISTS idx_analytics_created ON oleed_analytics(created_at);
      CREATE INDEX IF NOT EXISTS idx_analytics_page ON oleed_analytics(page_url);
    `;
    
    await pgPool.query(createAnalyticsTable);
    console.log('✅ PostgreSQL oleed_analytics table ready');
    
    await pgPool.query(createIndexes);
    console.log('✅ PostgreSQL indexes created');
  } catch (err) {
    console.error('Error initializing PostgreSQL analytics:', err);
  }
}

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for React
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true // Allow all origins in production for better web scaling
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// IP tracking middleware
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'unknown';
}

// Parse user agent to extract browser, OS, device info
function parseUserAgent(userAgent) {
  const ua = userAgent || '';
  
  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
  
  // Detect OS
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  // Detect device type
  let deviceType = 'Desktop';
  if (ua.includes('Mobile')) deviceType = 'Mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) deviceType = 'Tablet';
  
  return { browser, os, deviceType };
}

app.use(async (req, res, next) => {
  // Log all requests to PostgreSQL analytics
  if (process.env.DATABASE_URL) {
    const ip = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    const referer = req.headers['referer'] || req.headers['referrer'] || '';
    const pageUrl = req.path;
    const queryParams = JSON.stringify(req.query);
    const method = req.method;
    const language = req.headers['accept-language']?.split(',')[0] || '';
    const sessionId = req.headers['x-session-id'] || '';
    
    // Log to PostgreSQL asynchronously (non-blocking)
    pgPool.query(
      `INSERT INTO oleed_analytics 
       (ip_address, user_agent, browser, os, device_type, referer, page_url, query_params, method, language, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [ip, userAgent, browser, os, deviceType, referer, pageUrl, queryParams, method, language, sessionId]
    ).catch(err => {
      console.error('Error logging to PostgreSQL analytics:', err.message);
    });
  }
  
  // Also keep SQLite logging for backwards compatibility
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    const ip = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const referer = req.headers['referer'] || req.headers['referrer'] || '';
    const page = req.path;
    
    db.run(
      'INSERT INTO visitors (ip_address, user_agent, referer, page) VALUES (?, ?, ?, ?)',
      [ip, userAgent, referer, page],
      (err) => {
        if (err) console.error('Error logging visitor to SQLite:', err);
      }
    );
  }
  
  next();
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get visitor logs (IP tracking)
app.get('/api/visitors', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  
  const query = `
    SELECT id, ip_address, user_agent, referer, page, created_at
    FROM visitors
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  db.all(query, [limit, offset], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(rows);
    }
  });
});

// Get visitor statistics
app.get('/api/visitors/stats', (req, res) => {
  const statsQuery = `
    SELECT 
      COUNT(*) as total_visits,
      COUNT(DISTINCT ip_address) as unique_visitors,
      DATE(created_at) as visit_date,
      COUNT(*) as visits_per_day
    FROM visitors
    GROUP BY DATE(created_at)
    ORDER BY visit_date DESC
    LIMIT 30
  `;
  
  db.all(statsQuery, [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      // Also get overall stats
      const overallQuery = `
        SELECT 
          COUNT(*) as total_visits,
          COUNT(DISTINCT ip_address) as unique_visitors
        FROM visitors
      `;
      
      db.get(overallQuery, [], (err2, overall) => {
        if (err2) {
          res.status(500).json({ error: 'Internal server error' });
        } else {
          res.json({ overall, daily: rows });
        }
      });
    }
  });
});

// PostgreSQL Analytics Endpoints

// Get all analytics data from oleed_analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await pgPool.query(
      `SELECT * FROM oleed_analytics 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analytics statistics and insights
app.get('/api/analytics/stats', async (req, res) => {
  try {
    // Overall stats
    const overallStats = await pgPool.query(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(DISTINCT ip_address) as unique_visitors,
        COUNT(DISTINCT DATE(created_at)) as days_tracked
      FROM oleed_analytics
    `);
    
    // Top pages
    const topPages = await pgPool.query(`
      SELECT 
        page_url,
        COUNT(*) as visits
      FROM oleed_analytics
      WHERE page_url NOT LIKE '/api/%'
      GROUP BY page_url
      ORDER BY visits DESC
      LIMIT 10
    `);
    
    // Browser breakdown
    const browsers = await pgPool.query(`
      SELECT 
        browser,
        COUNT(*) as count
      FROM oleed_analytics
      GROUP BY browser
      ORDER BY count DESC
    `);
    
    // OS breakdown
    const operatingSystems = await pgPool.query(`
      SELECT 
        os,
        COUNT(*) as count
      FROM oleed_analytics
      GROUP BY os
      ORDER BY count DESC
    `);
    
    // Device types
    const devices = await pgPool.query(`
      SELECT 
        device_type,
        COUNT(*) as count
      FROM oleed_analytics
      GROUP BY device_type
      ORDER BY count DESC
    `);
    
    // Daily visits (last 30 days)
    const dailyVisits = await pgPool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as visits,
        COUNT(DISTINCT ip_address) as unique_visitors
      FROM oleed_analytics
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    // Top referrers
    const topReferrers = await pgPool.query(`
      SELECT 
        referer,
        COUNT(*) as count
      FROM oleed_analytics
      WHERE referer != '' AND referer IS NOT NULL
      GROUP BY referer
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Hourly distribution
    const hourlyDistribution = await pgPool.query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as visits
      FROM oleed_analytics
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `);
    
    res.json({
      overall: overallStats.rows[0],
      topPages: topPages.rows,
      browsers: browsers.rows,
      operatingSystems: operatingSystems.rows,
      devices: devices.rows,
      dailyVisits: dailyVisits.rows,
      topReferrers: topReferrers.rows,
      hourlyDistribution: hourlyDistribution.rows
    });
  } catch (err) {
    console.error('Error fetching analytics stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unique IPs with details
app.get('/api/analytics/ips', async (req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT 
        ip_address,
        COUNT(*) as visit_count,
        MAX(created_at) as last_visit,
        MIN(created_at) as first_visit,
        ARRAY_AGG(DISTINCT browser) as browsers_used,
        ARRAY_AGG(DISTINCT os) as operating_systems,
        ARRAY_AGG(DISTINCT device_type) as device_types
      FROM oleed_analytics
      GROUP BY ip_address
      ORDER BY visit_count DESC
      LIMIT 100
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching IP analytics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all scores (with pagination and ordering)
app.get('/api/scores', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  
  const query = `
    SELECT id, username, score, created_at 
    FROM scores 
    ORDER BY score DESC, created_at ASC 
    LIMIT ? OFFSET ?
  `;
  
  db.all(query, [limit, offset], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(rows);
    }
  });
});

// Get top scores
app.get('/api/scores/top/:limit?', (req, res) => {
  const limit = parseInt(req.params.limit) || 10;
  
  const query = `
    SELECT username, MAX(score) as score, created_at
    FROM scores 
    GROUP BY username
    ORDER BY score DESC 
    LIMIT ?
  `;
  
  db.all(query, [limit], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json(rows);
    }
  });
});

// Add new score
app.post('/api/scores', (req, res) => {
  const { username, score } = req.body;
  
  // Validation
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  if (typeof score !== 'number' || score < 0) {
    return res.status(400).json({ error: 'Valid score is required' });
  }
  
  if (username.length > 50) {
    return res.status(400).json({ error: 'Username too long' });
  }
  
  const cleanUsername = username.trim().substring(0, 50);
  
  const query = 'INSERT INTO scores (username, score) VALUES (?, ?)';
  
  db.run(query, [cleanUsername, score], function(err) {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Failed to save score' });
    } else {
      res.status(201).json({
        id: this.lastID,
        username: cleanUsername,
        score: score,
        message: 'Score saved successfully'
      });
    }
  });
});

// Get user's best score
app.get('/api/scores/user/:username', (req, res) => {
  const { username } = req.params;
  
  if (!username || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  const query = `
    SELECT username, MAX(score) as best_score, COUNT(*) as games_played
    FROM scores 
    WHERE username = ?
    GROUP BY username
  `;
  
  db.get(query, [username.trim()], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  });
});

// Get leaderboard rank for a specific score
app.get('/api/rank/:score', (req, res) => {
  const { score } = req.params;
  const numScore = parseInt(score);
  
  if (isNaN(numScore)) {
    return res.status(400).json({ error: 'Valid score required' });
  }
  
  const query = `
    SELECT COUNT(*) + 1 as rank
    FROM (
      SELECT username, MAX(score) as best_score
      FROM scores
      GROUP BY username
      HAVING best_score > ?
    ) as better_scores
  `;
  
  db.get(query, [numScore], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Internal server error' });
    } else {
      res.json({ score: numScore, rank: row.rank });
    }
  });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});