/**
 * LockBlock game-related WebSocket message handlers
 */

import { validateActionPayload } from '../utils/validators.js';
import {
  formatGameState,
  formatGameOverMessage,
  createGame,
  createAppSession,
  closeAppSession,
  hasAppSession,
  generateAppSessionMessage,
  addAppSessionSignature,
  createAppSessionWithSignatures,
  getRewardPool,
  addToRewardPool,
  withdrawFromRewardPool
} from '../services/index.js';
import logger from '../utils/logger.js';

/**
 * Handles a start game request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {Object} context - Application context containing roomManager and connections
 */
export async function handleStartGame(ws, payload, { roomManager, connections, sendError }) {
  if (!payload || typeof payload !== 'object') {
    return sendError(ws, 'INVALID_PAYLOAD', 'Invalid payload format');
  }

  const { roomId } = payload;

  if (!roomId) {
    return sendError(ws, 'INVALID_PAYLOAD', 'Room ID is required');
  }

  // Find the player trying to start the game
  let playerEoa = null;
  for (const [eoa, connection] of connections.entries()) {
    if (connection.ws === ws) {
      playerEoa = eoa;
      break;
    }
  }

  if (!playerEoa) {
    return sendError(ws, 'NOT_AUTHENTICATED', 'Player not authenticated');
  }

  // Get the room
  const room = roomManager.rooms.get(roomId);
  if (!room) {
    return sendError(ws, 'ROOM_NOT_FOUND', 'Room not found');
  }

  // Only the player in the room can start the game
  if (room.player.eoa !== playerEoa) {
    return sendError(ws, 'NOT_AUTHORIZED', 'Only the room player can start the game');
  }

  // Check if game already started
  if (room.gameStarted) {
    return sendError(ws, 'GAME_ALREADY_STARTED', 'Game has already started');
  }

  // Get current reward pool for game initialization
  const currentPool = getRewardPool();

  // Initialize game state if not already done
  if (!room.gameState) {
    room.gameState = createGame(
      room.player.eoa,
      room.player.entryDeposit,
      currentPool.totalAmount
    );
  }

  // Mark game as started
  room.gameStarted = true;

  // Create an app session for this game if not already created
  if (!hasAppSession(roomId)) {
    try {
      logger.nitro(`Creating app session for room ${roomId}`);
      // For single player, we create session with player and server
      const serverAddress = process.env.DEFAULT_GUEST_ADDRESS; // Use server as second participant
      const appId = await createAppSession(roomId, room.player.eoa, serverAddress);
      logger.nitro(`App session created with ID ${appId}`);

      // Store the app ID in the room object
      room.appId = appId;
    } catch (error) {
      logger.error(`Failed to create app session for room ${roomId}:`, error);
      // Continue with the game even if app session creation fails
    }
  }

  // Broadcast game started
  roomManager.broadcastToRoom(
    roomId,
    'game:started',
    {
      roomId,
      playerEoa: room.player.eoa,
      entryDeposit: room.player.entryDeposit,
      currentPool: currentPool.totalAmount
    }
  );

  // Send the initial game state
  roomManager.broadcastToRoom(
    roomId,
    'room:state',
    formatGameState(room.gameState, roomId)
  );
}

/**
 * Handles a player action request
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {Object} context - Application context containing roomManager and connections
 */
export async function handleAction(ws, payload, { roomManager, connections, sendError }) {
  // Validate payload
  const validation = validateActionPayload(payload);
  if (!validation.success) {
    return sendError(ws, 'INVALID_PAYLOAD', validation.error);
  }

  const { roomId, action } = payload;

  // Find the player making the action
  let playerEoa = null;
  for (const [eoa, connection] of connections.entries()) {
    if (connection.ws === ws) {
      playerEoa = eoa;
      break;
    }
  }

  if (!playerEoa) {
    return sendError(ws, 'NOT_AUTHENTICATED', 'Player not authenticated');
  }

  // Process the action
  const result = roomManager.processPlayerAction(roomId, action, playerEoa);
  if (!result.success) {
    return sendError(ws, 'ACTION_FAILED', result.error);
  }

  // Broadcast updated game state
  roomManager.broadcastToRoom(
    roomId,
    'room:state',
    formatGameState(result.gameState, roomId)
  );

  // Handle game over condition
  if (result.isGameOver) {
    const gameOverMessage = formatGameOverMessage(result.gameState);

    // Handle reward pool transactions
    try {
      if (result.gameResult === 'win') {
        // Player wins - withdraw from reward pool
        const withdrawResult = withdrawFromRewardPool(playerEoa);
        if (withdrawResult.success) {
          gameOverMessage.rewardAmount = withdrawResult.withdrawnAmount;
          logger.system(`Player ${playerEoa} won ${withdrawResult.withdrawnAmount} USDC from reward pool`);
        }
      } else if (result.gameResult === 'lose') {
        // Player loses - add entry deposit to reward pool
        const room = roomManager.rooms.get(roomId);
        const addResult = addToRewardPool(room.player.entryDeposit, playerEoa);
        if (addResult.success) {
          gameOverMessage.poolContribution = room.player.entryDeposit;
          logger.system(`Player ${playerEoa} contributed ${room.player.entryDeposit} USDC to reward pool`);
        }
      }
    } catch (error) {
      logger.error(`Error handling reward pool transaction for player ${playerEoa}:`, error);
    }

    roomManager.broadcastToRoom(
      roomId,
      'game:over',
      gameOverMessage
    );

    // Close the app session if one was created
    try {
      const room = roomManager.rooms.get(roomId);
      
      // First check if the room has an appId directly
      if (room && room.appId) {
        logger.nitro(`Closing app session with ID ${room.appId} for room ${roomId}`);

        // Calculate allocations based on game result (single player vs server)
        let finalAllocations;
        if (result.gameResult === 'win') {
          // Player wins - gets the entry deposit back plus any reward
          finalAllocations = [room.player.entryDeposit, '0', '0']; // Player gets deposit back
        } else {
          // Player loses - server/pool gets the entry deposit
          finalAllocations = ['0', room.player.entryDeposit, '0']; // Server gets deposit for pool
        }

        await closeAppSession(roomId, finalAllocations);
        logger.nitro(`App session closed for room ${roomId} with allocations: ${finalAllocations}`);
      }
      // Otherwise check the app sessions storage
      else if (hasAppSession(roomId)) {
        logger.nitro(`Closing app session from storage for room ${roomId}`);

        // Calculate allocations based on game result (single player vs server)
        let finalAllocations;
        if (result.gameResult === 'win') {
          // Player wins - gets the entry deposit back plus any reward
          finalAllocations = [room.player.entryDeposit, '0', '0']; // Player gets deposit back
        } else {
          // Player loses - server/pool gets the entry deposit
          finalAllocations = ['0', room.player.entryDeposit, '0']; // Server gets deposit for pool
        }

        await closeAppSession(roomId, finalAllocations);
        logger.nitro(`App session closed for room ${roomId} with allocations: ${finalAllocations}`);
      }
    } catch (error) {
      logger.error(`Failed to close app session for room ${roomId}:`, error);
      // Continue with room cleanup even if app session closure fails
    }

    // Clean up the room after a short delay
    setTimeout(() => {
      roomManager.closeRoom(roomId);
    }, 5000);
  }
}