/**
 * LockBlock game engine
 */
import { ethers } from 'ethers';

/**
 * @typedef {Object} GameState
 * @property {Object} player - Player information
 * @property {string} player.eoa - Player's Ethereum address
 * @property {Object} player.position - Player's current position
 * @property {number} player.position.x - X coordinate
 * @property {number} player.position.y - Y coordinate
 * @property {number} player.lives - Remaining lives
 * @property {number} player.score - Current score
 * @property {Array<Object>} chunks - Game chunks/levels
 * @property {number} currentChunk - Current chunk index
 * @property {boolean} isGameOver - Whether the game is over
 * @property {string|null} gameResult - 'win', 'lose', or null if game ongoing
 * @property {number} startTime - Game start timestamp
 * @property {number|null} endTime - Game end timestamp
 * @property {Object} rewardPool - Reward pool information
 * @property {string} rewardPool.totalAmount - Total pool amount in USDC
 * @property {string} entryDeposit - Entry deposit amount in USDC
 */

/**
 * Creates a new game state
 * @param {string} playerEoa - Player's Ethereum address
 * @param {string} entryDeposit - Entry deposit amount in USDC
 * @param {string} currentPoolAmount - Current reward pool amount
 * @returns {GameState} Initial game state
 */
export function createGame(playerEoa, entryDeposit = '0.01', currentPoolAmount = '0') {
  // Format address to proper checksum format
  const formattedPlayerEoa = ethers.getAddress(playerEoa);

  return {
    player: {
      eoa: formattedPlayerEoa,
      position: { x: 0, y: 0 },
      lives: 3,
      score: 0
    },
    chunks: generateInitialChunks(),
    currentChunk: 0,
    isGameOver: false,
    gameResult: null,
    startTime: Date.now(),
    endTime: null,
    rewardPool: {
      totalAmount: currentPoolAmount
    },
    entryDeposit: entryDeposit
  };
}

/**
 * Processes a player action in the game
 * @param {GameState} gameState - Current game state
 * @param {Object} action - Player action
 * @param {string} action.type - Action type ('move', 'jump', 'interact')
 * @param {Object} action.data - Action data (direction, position, etc.)
 * @param {string} playerEoa - Player's Ethereum address
 * @returns {Object} Result with updated game state or error
 */
export function processAction(gameState, action, playerEoa) {
  // Format player address to proper checksum format
  const formattedPlayerEoa = ethers.getAddress(playerEoa);

  // Check if the game is already over
  if (gameState.isGameOver) {
    return { success: false, error: 'Game is already over' };
  }

  // Verify player ownership
  if (gameState.player.eoa !== formattedPlayerEoa) {
    return { success: false, error: 'Not your game' };
  }

  // Process the action based on type
  let updatedGameState = { ...gameState };

  switch (action.type) {
    case 'move':
      updatedGameState = processMovement(updatedGameState, action.data);
      break;
    case 'jump':
      updatedGameState = processJump(updatedGameState, action.data);
      break;
    case 'interact':
      updatedGameState = processInteraction(updatedGameState, action.data);
      break;
    case 'complete_chunk':
      updatedGameState = processChunkCompletion(updatedGameState);
      break;
    case 'lose_life':
      updatedGameState = processLifeLoss(updatedGameState);
      break;
    default:
      return { success: false, error: 'Invalid action type' };
  }

  // Check for game over conditions
  updatedGameState = checkGameOverConditions(updatedGameState);

  return {
    success: true,
    gameState: updatedGameState
  };
}

/**
 * Generates initial game chunks/levels
 * @returns {Array<Object>} Array of chunk objects
 */
function generateInitialChunks() {
  return [
    {
      id: 0,
      name: 'Tutorial Chunk',
      difficulty: 1,
      obstacles: ['pit', 'spike'],
      collectibles: ['coin', 'powerup'],
      completed: false
    },
    {
      id: 1,
      name: 'Forest Chunk',
      difficulty: 2,
      obstacles: ['pit', 'spike', 'enemy'],
      collectibles: ['coin', 'gem'],
      completed: false
    },
    {
      id: 2,
      name: 'Mountain Chunk',
      difficulty: 3,
      obstacles: ['pit', 'spike', 'enemy', 'moving_platform'],
      collectibles: ['coin', 'gem', 'treasure'],
      completed: false
    }
  ];
}

/**
 * Processes player movement
 * @param {GameState} gameState - Current game state
 * @param {Object} moveData - Movement data (direction, distance)
 * @returns {GameState} Updated game state
 */
function processMovement(gameState, moveData) {
  const { direction, distance = 1 } = moveData;
  const newPosition = { ...gameState.player.position };

  switch (direction) {
    case 'left':
      newPosition.x = Math.max(0, newPosition.x - distance);
      break;
    case 'right':
      newPosition.x = newPosition.x + distance;
      break;
    case 'up':
      newPosition.y = Math.max(0, newPosition.y - distance);
      break;
    case 'down':
      newPosition.y = newPosition.y + distance;
      break;
  }

  return {
    ...gameState,
    player: {
      ...gameState.player,
      position: newPosition
    }
  };
}

/**
 * Processes player jump action
 * @param {GameState} gameState - Current game state
 * @param {Object} jumpData - Jump data
 * @returns {GameState} Updated game state
 */
function processJump(gameState, jumpData) {
  // For now, jumping is just a movement action
  // In a real implementation, this would handle jump physics
  return processMovement(gameState, { direction: 'up', distance: 2 });
}

/**
 * Processes player interaction with game objects
 * @param {GameState} gameState - Current game state
 * @param {Object} interactionData - Interaction data
 * @returns {GameState} Updated game state
 */
function processInteraction(gameState, interactionData) {
  const { objectType, value = 10 } = interactionData;
  let updatedGameState = { ...gameState };

  switch (objectType) {
    case 'coin':
      updatedGameState.player.score += value;
      break;
    case 'gem':
      updatedGameState.player.score += value * 2;
      break;
    case 'treasure':
      updatedGameState.player.score += value * 5;
      break;
    case 'powerup':
      // Add powerup logic here
      updatedGameState.player.score += value;
      break;
  }

  return updatedGameState;
}

/**
 * Processes chunk completion
 * @param {GameState} gameState - Current game state
 * @returns {GameState} Updated game state
 */
function processChunkCompletion(gameState) {
  const updatedChunks = [...gameState.chunks];
  updatedChunks[gameState.currentChunk].completed = true;

  const nextChunk = gameState.currentChunk + 1;
  const isGameComplete = nextChunk >= updatedChunks.length;

  return {
    ...gameState,
    chunks: updatedChunks,
    currentChunk: isGameComplete ? gameState.currentChunk : nextChunk,
    player: {
      ...gameState.player,
      score: gameState.player.score + 100 // Bonus for completing chunk
    }
  };
}

/**
 * Processes life loss
 * @param {GameState} gameState - Current game state
 * @returns {GameState} Updated game state
 */
function processLifeLoss(gameState) {
  return {
    ...gameState,
    player: {
      ...gameState.player,
      lives: Math.max(0, gameState.player.lives - 1),
      position: { x: 0, y: 0 } // Reset position
    }
  };
}

/**
 * Checks for game over conditions
 * @param {GameState} gameState - Current game state
 * @returns {GameState} Updated game state with game over status
 */
function checkGameOverConditions(gameState) {
  let isGameOver = false;
  let gameResult = null;

  // Check for loss condition (no lives left)
  if (gameState.player.lives <= 0) {
    isGameOver = true;
    gameResult = 'lose';
  }

  // Check for win condition (all chunks completed)
  const allChunksCompleted = gameState.chunks.every(chunk => chunk.completed);
  if (allChunksCompleted) {
    isGameOver = true;
    gameResult = 'win';
  }

  const endTime = isGameOver ? Date.now() : null;

  return {
    ...gameState,
    isGameOver,
    gameResult,
    endTime
  };
}

/**
 * Formats game state for client consumption
 * @param {GameState} gameState - Current game state
 * @param {string} roomId - Room ID
 * @returns {Object} Formatted game state for client
 */
export function formatGameState(gameState, roomId) {
  return {
    roomId,
    player: gameState.player,
    chunks: gameState.chunks,
    currentChunk: gameState.currentChunk,
    isGameOver: gameState.isGameOver,
    gameResult: gameState.gameResult,
    rewardPool: gameState.rewardPool,
    entryDeposit: gameState.entryDeposit
  };
}

/**
 * Formats game over message with reward information
 * @param {GameState} gameState - Current game state
 * @returns {Object} Game over message
 */
export function formatGameOverMessage(gameState) {
  const { gameResult, player, rewardPool, entryDeposit } = gameState;

  let rewardAmount = '0';
  let poolChange = '0';

  if (gameResult === 'win') {
    // Player wins: gets money from pool
    rewardAmount = rewardPool.totalAmount;
    poolChange = `-${rewardPool.totalAmount}`;
  } else if (gameResult === 'lose') {
    // Player loses: entry deposit goes to pool
    rewardAmount = '0';
    poolChange = `+${entryDeposit}`;
  }

  return {
    gameResult,
    playerScore: player.score,
    rewardAmount,
    poolChange,
    newPoolAmount: gameResult === 'win' ? '0' :
                   (parseFloat(rewardPool.totalAmount) + parseFloat(entryDeposit)).toString()
  };
}