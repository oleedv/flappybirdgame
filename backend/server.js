const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Database setup
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'database.db')
  : path.join(__dirname, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.run(createTableQuery, (err) => {
    if (err) {
      console.error('Error creating table:', err);
    } else {
      console.log('Database table ready');
    }
  });
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
    ? ['https://your-app-domain.com'] // Replace with your actual domain
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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
    res.sendFile(path.join(__dirname, '../build/index.html'));
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