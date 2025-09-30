import React, { Component } from 'react';
import axios from 'axios';
import './App.css';

// Game constants - Made much easier!
const HEIGHT = 500;
const WIDTH = 800;
const PIPE_WIDTH = 60;
const MIN_PIPE_HEIGHT = 30;
const FPS = 60;
const PIPE_GAP = 200; // Much larger gap for easier gameplay

// Bird Class
class Bird {
  constructor(ctx) {
    this.ctx = ctx;
    this.x = 150;
    this.y = HEIGHT / 2;
    this.gravity = 0.4; // Reduced gravity for easier control
    this.velocity = 0;
    this.radius = 12; // Smaller bird for easier passage
  }

  draw = () => {
    // Draw bird with gradient and better styling
    const gradient = this.ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(1, '#FF8C00');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Add outline
    this.ctx.strokeStyle = '#FF4500';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // Add eye
    this.ctx.fillStyle = '#000';
    this.ctx.beginPath();
    this.ctx.arc(this.x + 5, this.y - 3, 3, 0, 2 * Math.PI);
    this.ctx.fill();
  };

  update = () => {
    this.velocity += this.gravity;
    this.y += this.velocity;
  };

  jump = () => {
    this.velocity = -8; // Gentler jump for better control
  };

  getBounds = () => ({
    left: this.x - this.radius,
    right: this.x + this.radius,
    top: this.y - this.radius,
    bottom: this.y + this.radius
  });
}

// Pipe Class
class Pipe {
  constructor(ctx, height, isBottom = false) {
    this.ctx = ctx;
    this.isDead = false;
    this.x = WIDTH;
    this.width = PIPE_WIDTH;
    this.isBottom = isBottom;
    this.scored = false;
    
    if (isBottom) {
      this.y = HEIGHT - height;
      this.height = height;
    } else {
      this.y = 0;
      this.height = height;
    }
  }

  draw = () => {
    // Create gradient for pipes
    const gradient = this.ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
    gradient.addColorStop(0, '#228B22');
    gradient.addColorStop(0.5, '#32CD32');
    gradient.addColorStop(1, '#228B22');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(this.x, this.y, this.width, this.height);
    
    // Add border
    this.ctx.strokeStyle = '#006400';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(this.x, this.y, this.width, this.height);
    
    // Add pipe cap
    const capHeight = 30;
    const capWidth = this.width + 10;
    const capX = this.x - 5;
    
    if (this.isBottom) {
      this.ctx.fillRect(capX, this.y - capHeight, capWidth, capHeight);
      this.ctx.strokeRect(capX, this.y - capHeight, capWidth, capHeight);
    } else {
      this.ctx.fillRect(capX, this.y + this.height, capWidth, capHeight);
      this.ctx.strokeRect(capX, this.y + this.height, capWidth, capHeight);
    }
  };

  update = () => {
    this.x -= 1.5; // Much slower movement for easier gameplay
    if (this.x + PIPE_WIDTH < 0) {
      this.isDead = true;
    }
  };

  getBounds = () => ({
    left: this.x,
    right: this.x + this.width,
    top: this.y,
    bottom: this.y + this.height
  });
}

class Game extends Component {
  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.state = {
      gameStarted: false,
      gameOver: false,
      score: 0,
      paused: false
    };
    this.frameCount = 0;
    this.pipes = [];
    this.bird = null;
    this.loop = null;
  }

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('click', this.onClick);
    this.initGame();
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('click', this.onClick);
    if (this.loop) {
      clearInterval(this.loop);
    }
  }

  initGame = () => {
    const ctx = this.getCtx();
    this.bird = new Bird(ctx);
    this.pipes = [];
    this.frameCount = 0;
    this.setState({ score: 0, gameOver: false, gameStarted: false });
  };

  startGame = () => {
    if (!this.state.gameStarted && !this.state.gameOver) {
      this.setState({ gameStarted: true });
      this.loop = setInterval(this.gameLoop, 1000 / FPS);
    }
  };

  togglePause = () => {
    if (this.state.gameStarted && !this.state.gameOver) {
      if (this.state.paused) {
        this.loop = setInterval(this.gameLoop, 1000 / FPS);
      } else {
        clearInterval(this.loop);
      }
      this.setState({ paused: !this.state.paused });
    }
  };

  restart = () => {
    if (this.loop) {
      clearInterval(this.loop);
    }
    this.initGame();
  };

  onKeyDown = (e) => {
    e.preventDefault();
    switch (e.code) {
      case 'Space':
        if (!this.state.gameStarted) {
          this.startGame();
        }
        if (this.state.gameStarted && !this.state.gameOver && !this.state.paused) {
          this.bird.jump();
        }
        break;
      case 'KeyP':
        this.togglePause();
        break;
      case 'KeyR':
        this.restart();
        break;
      default:
        break;
    }
  };

  onClick = () => {
    if (!this.state.gameStarted) {
      this.startGame();
    } else if (this.state.gameStarted && !this.state.gameOver && !this.state.paused) {
      this.bird.jump();
    }
  };
  getCtx = () => this.canvasRef.current.getContext('2d');

  generatePipes = () => {
    const ctx = this.getCtx();
    const minHeight = MIN_PIPE_HEIGHT;
    
    // Make the first few pipes easier with larger gaps
    const isEarlyGame = this.state.score < 3;
    const currentGap = isEarlyGame ? PIPE_GAP + 50 : PIPE_GAP;
    
    const maxHeight = HEIGHT - currentGap - minHeight;
    const topPipeHeight = minHeight + Math.random() * (maxHeight - minHeight);
    const bottomPipeHeight = HEIGHT - topPipeHeight - currentGap;

    return [
      new Pipe(ctx, topPipeHeight, false),
      new Pipe(ctx, bottomPipeHeight, true)
    ];
  };

  gameLoop = () => {
    if (!this.state.paused) {
      this.update();
      this.draw();
    }
  };
  submitScore = async () => {
    try {
      const newScore = {
        username: this.props.username,
        score: this.state.score
      };
      const apiUrl = process.env.NODE_ENV === 'production' 
        ? '/api/scores' 
        : 'http://localhost:3001/api/scores';
      
      await axios.post(apiUrl, newScore);
      this.props.onScoreSubmitted();
    } catch (error) {
      console.error('Failed to submit score:', error);
      // Don't break the game if score submission fails
    }
  };

  update = () => {
    this.frameCount++;
    
    // Generate new pipes much less frequently for easier gameplay
    if (this.frameCount % 240 === 0) { // Slower pipe generation
      const pipes = this.generatePipes();
      this.pipes.push(...pipes);
    }

    // Update pipe positions
    this.pipes.forEach(pipe => {
      pipe.update();
      // Check for scoring (only count once per pipe pair)
      if (!pipe.scored && pipe.x + PIPE_WIDTH < this.bird.x && !pipe.isBottom) {
        pipe.scored = true;
        this.setState({ score: this.state.score + 1 });
      }
    });
    
    this.pipes = this.pipes.filter(pipe => !pipe.isDead);

    // Update bird position
    this.bird.update();

    // Check for collisions
    if (this.checkCollisions()) {
      this.setState({ gameOver: true });
      this.submitScore();
      clearInterval(this.loop);
    }
  };
  checkCollisions = () => {
    const birdBounds = this.bird.getBounds();
    
    // More forgiving bounds collision - leave some margin
    if (birdBounds.top <= -5 || birdBounds.bottom >= HEIGHT + 5) {
      return true;
    }

    // More forgiving pipe collision - reduce collision area by 3 pixels on each side
    const margin = 3;
    return this.pipes.some(pipe => {
      const pipeBounds = pipe.getBounds();
      return (
        birdBounds.right - margin > pipeBounds.left + margin &&
        birdBounds.left + margin < pipeBounds.right - margin &&
        birdBounds.bottom - margin > pipeBounds.top + margin &&
        birdBounds.top + margin < pipeBounds.bottom - margin
      );
    });
  };

  drawBackground = (ctx) => {
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98FB98');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Ground
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, HEIGHT - 50, WIDTH, 50);
  };

  drawUI = (ctx) => {
    // Score
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Score: ${this.state.score}`, WIDTH / 2, 50);

    if (!this.state.gameStarted) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 40px Arial';
      ctx.fillText('Click or Press SPACE to Start!', WIDTH / 2, HEIGHT / 2 - 20);
      
      ctx.font = '18px Arial';
      ctx.fillText('EASY MODE: Larger gaps, slower pipes, forgiving collisions!', WIDTH / 2, HEIGHT / 2 + 20);
      ctx.fillText('Controls: SPACE/Click - Jump, P - Pause, R - Restart', WIDTH / 2, HEIGHT / 2 + 50);
    }

    if (this.state.paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 40px Arial';
      ctx.fillText('PAUSED', WIDTH / 2, HEIGHT / 2);
      ctx.font = '20px Arial';
      ctx.fillText('Press P to Resume', WIDTH / 2, HEIGHT / 2 + 40);
    }

    if (this.state.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 40px Arial';
      ctx.fillText('Game Over!', WIDTH / 2, HEIGHT / 2 - 40);
      ctx.font = '30px Arial';
      ctx.fillText(`Final Score: ${this.state.score}`, WIDTH / 2, HEIGHT / 2);
      ctx.font = '20px Arial';
      ctx.fillText('Press R to Restart', WIDTH / 2, HEIGHT / 2 + 40);
    }
  };

  draw = () => {
    const ctx = this.canvasRef.current.getContext('2d');
    
    // Clear and draw background
    this.drawBackground(ctx);
    
    // Draw game objects
    this.pipes.forEach(pipe => pipe.draw());
    if (this.bird) {
      this.bird.draw();
    }
    
    // Draw UI
    this.drawUI(ctx);
  };
  render() {
    return (
      <div className="game-container">
        <canvas
          ref={this.canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="game-canvas"
        />
        <div className="game-controls">
          <button onClick={this.restart} className="control-btn">
            Restart (R)
          </button>
          <button onClick={this.togglePause} className="control-btn">
            {this.state.paused ? 'Resume (P)' : 'Pause (P)'}
          </button>
        </div>
      </div>
    );
  }
}

class App extends Component {
  state = {
    username: '',
    hasUsername: false,
    scores: [],
    loading: true,
    error: null
  };

  componentDidMount() {
    this.getScores();
  }

  getUsername = (e) => {
    e.preventDefault();
    const username = e.target.username.value.trim();
    if (username) {
      this.setState({
        username,
        hasUsername: true
      });
    }
  };

  getScores = async () => {
    try {
      this.setState({ loading: true, error: null });
      const apiUrl = process.env.NODE_ENV === 'production' 
        ? '/api/scores/top/10' 
        : 'http://localhost:3001/api/scores/top/10';
        
      const response = await axios.get(apiUrl);
      
      // Data is already sorted by the backend
      const scores = response.data.map(data => ({ 
        username: data.username, 
        score: data.score 
      }));

      this.setState({ scores, loading: false });
    } catch (error) {
      console.error('Failed to fetch scores:', error);
      this.setState({ 
        error: 'Failed to load leaderboard. Please try again later.', 
        loading: false 
      });
    }
  };

  onScoreSubmitted = () => {
    this.getScores(); // Refresh leaderboard after score submission
  };
  render() {
    const { hasUsername, username, scores, loading, error } = this.state;

    return (
      <div className="app">
        <header className="app-header">
          <h1 className="game-title">Flappy Bird
          </h1>
        </header>

        <main className="app-main">
          {!hasUsername ? (
            <div className="username-form-container">
              <form className="username-form" onSubmit={this.getUsername}>
                <h3>Ready to Play?</h3>
                <p>Enter your username to start the game and compete on the leaderboard!</p>
                <div className="form-group">
                  <label htmlFor="username">Username:</label>
                  <input 
                    type="text" 
                    id="username" 
                    name="username"
                    maxLength="20"
                    required
                    placeholder="Enter your username"
                  />
                </div>
                <button type="submit" className="submit-btn">
                  Start Game
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="welcome-message">
                <h2>Good luck, {username}!</h2>
              </div>
              
              <Game 
                username={username} 
                onScoreSubmitted={this.onScoreSubmitted}
              />
            </>
          )}

          <div className="leaderboard-container">
            <h3 className="leaderboard-title">
              <span role="img" aria-label="trophy">🏆</span> Leaderboard
            </h3>
            
            {loading ? (
              <div className="loading">Loading scores...</div>
            ) : error ? (
              <div className="error">{error}</div>
            ) : scores.length > 0 ? (
              <div className="leaderboard">
                <table className="scores-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((score, index) => (
                      <tr 
                        key={index} 
                        className={score.username === username ? 'current-player' : ''}
                      >
                        <td className="rank">
                          {index === 0 ? <span role="img" aria-label="first place">🥇</span> : 
                           index === 1 ? <span role="img" aria-label="second place">🥈</span> : 
                           index === 2 ? <span role="img" aria-label="third place">🥉</span> : 
                           `#${index + 1}`}
                        </td>
                        <td className="username">{score.username}</td>
                        <td className="score">{score.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-scores">No scores yet. Be the first to play!</div>
            )}
          </div>
        </main>

        <footer className="app-footer">
          <p>Created by <strong>Oleed</strong> <span role="img" aria-label="heart">❤️</span></p>
        </footer>
      </div>
    );
  }
}


export default App;
