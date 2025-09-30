# 🐦 Flappy Bird Game

A modern, responsive recreation of the classic Flappy Bird game built with React.js. **Optimized for fun gameplay** with larger pipe gaps, slower movement, and forgiving collision detection!

Hosted on [Oleed.no](oleed.no)

![Flappy Bird Game](https://img.shields.io/badge/React-16.8.6-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Node](https://img.shields.io/badge/Node-%3E%3D12.0.0-brightgreen)

## How to Play

1. **Start**: Enter your username and click "Start Game" or press SPACE
2. **Jump**: Click anywhere, press SPACE, or tap on mobile to make the bird jump
3. **Avoid**: Navigate through the green pipes without touching them
4. **Score**: Earn points by successfully passing through pipe pairs
5. **Compete**: Your score will be added to the leaderboard automatically

### Controls
- **SPACE** or **Click**: Make the bird jump
- **P**: Pause/Resume game
- **R**: Restart game

## Quick Start

### Prerequisites
- Node.js (version 12.0.0 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flappybird-game
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install all dependencies (frontend and backend)**
   ```bash
   npm run install:all
   ```

4. **Start both backend and frontend servers**
   ```bash
   npm run dev
   ```
   
   Or start them separately:
   ```bash
   # Terminal 1 - Backend (SQLite API)
   npm run server:dev
   
   # Terminal 2 - Frontend (React app)
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000` to play the game!




## Available Scripts

### Frontend Scripts
- **`npm start`** - Starts the React development server on port 3000
- **`npm run build`** - Builds the React app for production
- **`npm test`** - Runs the test suite
- **`npm run eject`** - Ejects from Create React App (irreversible)

### Backend Scripts  
- **`npm run server`** - Starts the production backend server
- **`npm run server:dev`** - Starts the backend in development mode with nodemon

### Full Stack Scripts
- **`npm run dev`** - Starts both frontend and backend in development mode
- **`npm run install:all`** - Installs dependencies for both frontend and backend
- **`npm run build:full`** - Builds the entire application for production deployment

## Database & API

The game uses a **SQLite database** with an **Express.js REST API**:

### API Endpoints
- **GET** `/api/scores` - Fetch all scores (with pagination)
- **GET** `/api/scores/top/:limit` - Get top scores (default: 10)
- **POST** `/api/scores` - Add a new score
- **GET** `/api/scores/user/:username` - Get user's best score and stats
- **GET** `/api/rank/:score` - Get leaderboard rank for a score
- **GET** `/api/health` - Health check endpoint

### Database Schema
The SQLite database automatically creates a `scores` table:
```sql
CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

This will create a `build` folder with optimized files ready for deployment.

### Deploy to Railway (Recommended)

**Railway** is perfect for this full-stack app with SQLite:

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Ready for Railway deployment"
   git push origin main
   ```

2. **Deploy on Railway**:
   - Go to [Railway.app](https://railway.app)
   - Connect your GitHub repository
   - Railway will automatically detect the `railway.json` config
   - The build process will install dependencies and build the React app
   - Your app will be live with both frontend and API!


### Environment Variables
For production, you may want to set:
- `NODE_ENV=production`
- Database path and connection settings
- CORS origins for your domain

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**Enjoy the game**