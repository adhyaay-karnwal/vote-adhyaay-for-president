// Disable right-click and common shortcuts
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (e.key === 'F12' || (e.ctrlKey && (e.key === 'i' || e.key === 'u'))) {
    e.preventDefault();
  }
});

// Game variables
let player = document.getElementById('player');
let game = document.getElementById('game');
let scoreElement = document.getElementById('score');
let comboElement = document.getElementById('combo');
let gameOverScreen = document.getElementById('game-over-screen');
let finalScoreElement = document.getElementById('final-score');
let startScreen = document.getElementById('start-screen');
let gameContainer = document.getElementById('game-container');
let leaderboardScreen = document.getElementById('leaderboard-screen');
let leaderboardList = document.getElementById('leaderboard-list');
let viewLeaderboardStartBtn = document.getElementById('view-leaderboard-start-btn');

const MAX_OBSTACLES = 20; // Define the maximum number of obstacles

let score = 0;
let combo = 0;
let gameInterval;
let obstacles = [];
let powerUps = [];
let isGameOver = false;
let difficultyLevel = 1;
let playerName = '';
let leaderboard = [];

// Particle system
function createParticles() {
  const particleContainer = document.getElementById('particle-container');
  for (let i = 0; i < 100; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    particle.style.left = Math.random() * 100 + 'vw';
    particle.style.top = Math.random() * 100 + 'vh';
    particle.style.animationDuration = (Math.random() * 3 + 2) + 's';
    particle.style.opacity = Math.random();
    particleContainer.appendChild(particle);
  }
}

// Replace createObstaclePreviews with createCandidatePhotos
function createCandidatePhotos() {
  const photoContainer = document.getElementById('candidate-photos');
  const images = ['pic.png', 'pic2.png', 'pic3.png'];
  
  images.forEach(image => {
    const photo = document.createElement('div');
    photo.classList.add('candidate-photo');
    photo.style.backgroundImage = `url('${image}')`;
    photoContainer.appendChild(photo);
  });
}

// Call both functions
createParticles();
createCandidatePhotos();

// Load leaderboard from Firebase
async function loadLeaderboard() {
  try {
    const dbRef = window.firebaseRef(window.firebaseDatabase, 'leaderboard');
    const snapshot = await window.firebaseGet(dbRef);
    if (snapshot.exists()) {
      leaderboard = Object.values(snapshot.val());
    } else {
      leaderboard = [];
    }
    leaderboard.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    leaderboard = [];
  }
}

// Save leaderboard to Firebase
async function saveLeaderboard() {
  try {
    const dbRef = window.firebaseRef(window.firebaseDatabase, 'leaderboard');
    await window.firebaseSet(dbRef, leaderboard);
  } catch (error) {
    console.error('Error saving leaderboard:', error);
  }
}

// Update leaderboard
async function updateLeaderboard(name, score) {
  await loadLeaderboard(); // Reload the latest leaderboard data
  
  const existingEntryIndex = leaderboard.findIndex(entry => entry.name === name);
  if (existingEntryIndex !== -1) {
    // Update score if it's higher than the existing one
    if (score > leaderboard[existingEntryIndex].score) {
      leaderboard[existingEntryIndex].score = score;
    }
  } else {
    // Add new entry
    leaderboard.push({ name, score });
  }
  
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 10); // Keep only top 10
  await saveLeaderboard();
}

// Add this new function to format numbers
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  } else {
    return num.toString();
  }
}

// Modify the displayLeaderboard function
function displayLeaderboard() {
  leaderboardList.innerHTML = '';
  leaderboard.forEach((entry, index) => {
    const li = document.createElement('li');
    li.textContent = `${entry.name}: ${formatNumber(entry.score)} votes`;
    leaderboardList.appendChild(li);
  });
}

// Start the game
document.getElementById('start-btn').addEventListener('click', function() {
  playerName = document.getElementById('player-name').value.trim();
  if (playerName) {
    startScreen.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    startGame();
  } else {
    alert('Please enter your name before starting the campaign.');
  }
});

// Retry the game
document.getElementById('retry-btn').addEventListener('click', function() {
  gameOverScreen.classList.add('hidden');
  startGame();
});

// View leaderboard
document.getElementById('view-leaderboard-btn').addEventListener('click', function() {
  gameOverScreen.classList.add('hidden');
  leaderboardScreen.classList.remove('hidden');
  displayLeaderboard();
});

// Back to game
document.getElementById('back-to-game-btn').addEventListener('click', function() {
  leaderboardScreen.classList.add('hidden');
  if (isGameOver) {
    gameOverScreen.classList.remove('hidden');
  } else {
    startScreen.classList.remove('hidden');
  }
});

// Track mouse/touch movement
function handleMove(clientX, clientY) {
  if (isGameOver) return;

  let gameRect = game.getBoundingClientRect();
  let playerRect = player.getBoundingClientRect();

  let newX = clientX - gameRect.left - playerRect.width / 2;
  let newY = clientY - gameRect.top - playerRect.height / 2;

  // Ensure the player stays within the game boundaries
  newX = Math.max(0, Math.min(newX, gameRect.width - playerRect.width));
  newY = Math.max(0, Math.min(newY, gameRect.height - playerRect.height));
  
  player.style.left = newX + 'px';
  player.style.bottom = 'auto';
  player.style.top = newY + 'px';
}

document.addEventListener('mousemove', function(e) {
  handleMove(e.clientX, e.clientY);
});

document.addEventListener('touchmove', function(e) {
  e.preventDefault(); // Prevent scrolling
  handleMove(e.touches[0].clientX, e.touches[0].clientY);
});

// Start Game function
function startGame() {
  resetGame();
  isGameOver = false;
  gameInterval = setInterval(updateGame, 1000 / 60); // 60 FPS
}

// Create Obstacles
function createObstacle() {
  let obstacle = document.createElement('div');
  obstacle.classList.add('obstacle');

  const shapes = [
    { type: 'triangle', color: 'rgba(255, 0, 0, 0.3)', size: '60px', behavior: 'spin' },
    { type: 'star', color: 'rgba(0, 255, 0, 0.3)', size: '40px', behavior: 'zigzag' },
    { type: 'square', color: 'rgba(255, 255, 0, 0.3)', size: '50px', behavior: 'normal' },
    { type: 'circle', color: 'rgba(255, 165, 0, 0.3)', size: '50px', behavior: 'fast' },
    { type: 'hexagon', color: 'rgba(0, 0, 255, 0.3)', size: '50px', behavior: 'spin' },
  ];
  
  const shape = shapes[Math.floor(Math.random() * shapes.length)];
  const images = ['pic.png', 'pic2.png', 'pic3.png'];
  const randomImage = images[Math.floor(Math.random() * images.length)];
  
  obstacle.style.width = shape.size;
  obstacle.style.height = shape.size;
  obstacle.style.backgroundColor = shape.color;
  obstacle.style.backgroundImage = `url('${randomImage}')`;
  obstacle.style.backgroundSize = 'cover';
  obstacle.style.backgroundPosition = 'center';
  obstacle.style.backgroundBlendMode = "overlay";
  
  if (shape.type === 'triangle') {
    obstacle.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
  } else if (shape.type === 'star') {
    obstacle.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
  } else if (shape.type === 'circle') {
    obstacle.style.borderRadius = '50%';
  } else if (shape.type === 'hexagon') {
    obstacle.style.clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
  }
  
  obstacle.style.left = Math.random() * (game.clientWidth - parseInt(shape.size)) + 'px';
  obstacle.style.top = '0';
  obstacle.dataset.behavior = shape.behavior;
  game.appendChild(obstacle);
  obstacles.push(obstacle);
}

// Create Power-ups
function createPowerUp() {
  let powerUp = document.createElement('div');
  powerUp.classList.add('power-up');
  powerUp.style.left = Math.random() * (game.clientWidth - 30) + 'px';
  powerUp.style.top = '0';
  game.appendChild(powerUp);
  powerUps.push(powerUp);
}

// Update Game Logic
function updateGame() {
  score += 1 + Math.floor(combo / 10);
  scoreElement.textContent = formatNumber(score);
  comboElement.textContent = combo;

  if (Math.floor(score / 100) >= difficultyLevel) {
    difficultyLevel++;
  }

  if (Math.random() < 0.02 * difficultyLevel && obstacles.length < MAX_OBSTACLES) {
    createObstacle();
  }

  if (Math.random() < 0.005) {
    createPowerUp();
  }

  updateObstacles();
  updatePowerUps();
  checkCollision();
}

// Update Obstacles
function updateObstacles() {
  obstacles.forEach((obstacle, index) => {
    let top = parseFloat(window.getComputedStyle(obstacle).top) || 0;
    if (top > game.clientHeight) {
      obstacle.remove();
      obstacles.splice(index, 1);
      combo++;
    } else {
      if (obstacle.dataset.behavior === 'spin') {
        obstacle.style.transform = `rotate(${top * 0.3}deg)`;
        obstacle.style.top = top + 6.5 + 'px';
      } else if (obstacle.dataset.behavior === 'zigzag') {
        obstacle.style.top = top + 3 + 'px';
        obstacle.style.left = Math.sin(top * 0.1) * 10 + parseFloat(obstacle.style.left) + 'px';
      } else if(obstacle.dataset.behavior === 'fast') {
        obstacle.style.top = top + 10 + 'px';
      } else {
        obstacle.style.top = top + 5 + 'px';
      }
    }
  });
}

// Update Power-ups
function updatePowerUps() {
  powerUps.forEach((powerUp, index) => {
    let top = parseFloat(window.getComputedStyle(powerUp).top) || 0;
    if (top > game.clientHeight) {
      powerUp.remove();
      powerUps.splice(index, 1);
    } else {
      powerUp.style.top = top + 3 + 'px';
    }
  });
}

// Check for Collision
function checkCollision() {
  let playerRect = player.getBoundingClientRect();
  
  obstacles.forEach((obstacle) => {
    let obstacleRect = obstacle.getBoundingClientRect();
    // Adjust the hitbox size by reducing it slightly
    let hitboxMargin = 5; // Adjust this value as needed
    if (
      playerRect.left < obstacleRect.right - hitboxMargin &&
      playerRect.right > obstacleRect.left + hitboxMargin &&
      playerRect.top < obstacleRect.bottom - hitboxMargin &&
      playerRect.bottom > obstacleRect.top + hitboxMargin
    ) {
      endGame();
    }
  });

  powerUps.forEach((powerUp, index) => {
    let powerUpRect = powerUp.getBoundingClientRect();
    if (
      playerRect.left < powerUpRect.right &&
      playerRect.right > powerUpRect.left &&
      playerRect.top < powerUpRect.bottom &&
      playerRect.bottom > powerUpRect.top
    ) {
      score += 50;
      combo += 5;
      powerUp.remove();
      powerUps.splice(index, 1);
    }
  });
}

// End Game
async function endGame() {
  clearInterval(gameInterval);
  isGameOver = true;
  finalScoreElement.textContent = formatNumber(score);
  await updateLeaderboard(playerName, score);
  gameOverScreen.classList.remove('hidden');
}

// Reset Game State
function resetGame() {
  score = 0;
  combo = 0;
  difficultyLevel = 1;
  scoreElement.textContent = score;
  comboElement.textContent = combo;
  obstacles.forEach(obstacle => obstacle.remove());
  obstacles = [];
  powerUps.forEach(powerUp => powerUp.remove());
  powerUps = [];
  player.style.left = '50%';
}

// Initialize the game
async function initGame() {
  await loadLeaderboard();
  // Remove the viewLeaderboardStartBtn event listener from here
  // ... (rest of the initialization code)
}

// Call initGame instead of loadLeaderboard
initGame();

// Add this to prevent scrolling on mobile devices
document.body.addEventListener('touchmove', function(e) {
  e.preventDefault();
}, { passive: false });

// Add this near the top of the file with other event listeners
document.getElementById('view-leaderboard-start-btn').addEventListener('click', function() {
  startScreen.classList.add('hidden');
  leaderboardScreen.classList.remove('hidden');
  displayLeaderboard();
});

// Modify the existing back-to-game button listener
document.getElementById('back-to-game-btn').addEventListener('click', function() {
  leaderboardScreen.classList.add('hidden');
  if (isGameOver) {
    gameOverScreen.classList.remove('hidden');
  } else {
    startScreen.classList.remove('hidden');
  }
});

// Modify this function to load and display the leaderboard
async function showLeaderboard() {
  await loadLeaderboard();
  displayLeaderboard();
  startScreen.classList.add('hidden');
  leaderboardScreen.classList.remove('hidden');
}

// Replace the existing event listener for view-leaderboard-start-btn
document.getElementById('view-leaderboard-start-btn').addEventListener('click', showLeaderboard);

// Modify the view-leaderboard-btn event listener as well
document.getElementById('view-leaderboard-btn').addEventListener('click', showLeaderboard);

// Modify the back-to-game button listener
document.getElementById('back-to-game-btn').addEventListener('click', function() {
  leaderboardScreen.classList.add('hidden');
  if (isGameOver) {
    gameOverScreen.classList.remove('hidden');
  } else {
    startScreen.classList.remove('hidden');
  }
});

// Modify the initGame function
async function initGame() {
  await loadLeaderboard();
  // ... (rest of the initialization code)
}

// Call initGame at the end of the file
initGame();

// ... (keep the rest of the existing code)

// Add this near the top of the file with other event listeners
document.getElementById('learn-more-btn').addEventListener('click', function() {
  window.open('https://sites.google.com/mhrd.org/adhyaay-karnwal/home?authuser=3', '_blank');
});

