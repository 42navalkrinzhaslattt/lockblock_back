/**
 * Room-related WebSocket message handlers
 */

import { validateJoinRoomPayload } from '../utils/validators.js';
import { formatGameState, generateAppSessionMessage } from '../services/index.js';
import logger from '../utils/logger.js';

/**
 * Handles a request to join a room
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} payload - Request payload
 * @param {Object} context - Application context containing roomManager and connections
 */
export async function handleJoinRoom(ws, payload, { roomManager, connections, sendError }) {
  // Validate payload
  const validation = validateJoinRoomPayload(payload);
  if (!validation.success) {
    return sendError(ws, 'INVALID_PAYLOAD', validation.error);
  }

  const { roomId, eoa } = payload;
  console.log(`Processing ${validation.isCreating ? 'CREATE' : 'JOIN'} request for EOA: ${eoa}, roomId: ${roomId || 'NEW'}`);

  // Check if address is already connected
  if (connections.has(eoa)) {
    return sendError(ws, 'ALREADY_CONNECTED', 'Address already connected');
  }

  let result;
  if (validation.isCreating) {
    // Creating a new room for LockBlock (single player)
    const entryDeposit = payload.entryDeposit || '0.01'; // Default entry deposit
    const difficulty = payload.difficulty || 'normal'; // Default difficulty

    const newRoomId = roomManager.createRoom(entryDeposit, difficulty);
    console.log(`Created new LockBlock room with ID: ${newRoomId}, deposit: ${entryDeposit}, difficulty: ${difficulty}`);

    // Join the newly created room as the single player
    result = roomManager.joinRoom(newRoomId, eoa, ws);

    if (result.success) {
      console.log(`New LockBlock room created: ${newRoomId} for player: ${eoa}`);

      // Send room ID and game info to client
      ws.send(JSON.stringify({
        type: 'room:created',
        roomId: newRoomId,
        role: 'player',
        entryDeposit: result.entryDeposit,
        rewardInfo: result.rewardInfo
      }));
    }
  } else {
    // Joining an existing room (for spectating or if we support multiple players later)
    result = roomManager.joinRoom(roomId, eoa, ws);

    if (result.success) {
      console.log(`Player ${eoa} joined room: ${roomId} as ${result.role}`);
    }
  }
  
  if (!result.success) {
    return sendError(ws, 'JOIN_FAILED', result.error);
  }

  // Store connection
  connections.set(eoa, { ws, roomId: result.roomId });

  // Get room
  const room = roomManager.rooms.get(result.roomId);

  // Send room state to all players
  if (room.gameState) {
    roomManager.broadcastToRoom(
      result.roomId, 
      'room:state', 
      formatGameState(room.gameState, result.roomId)
    );
  }

  // Notify player that room is ready (single player - always ready when joined)
  if (result.isRoomReady) {
    roomManager.broadcastToRoom(result.roomId, 'room:ready', {
      roomId: result.roomId,
      playerEoa: room.player.eoa,
      entryDeposit: room.player.entryDeposit,
      rewardInfo: room.rewardInfo
    });

    logger.nitro(`LockBlock room ${result.roomId} is ready for single player`);
    logger.data(`Room player:`, { eoa: room.player.eoa, deposit: room.player.entryDeposit });

    // For single player, we can optionally generate app session message immediately
    // or wait for the player to start the game
    try {
      const serverAddress = process.env.DEFAULT_GUEST_ADDRESS;
      const appSessionMessage = await generateAppSessionMessage(
        result.roomId,
        room.player.eoa,
        serverAddress
      );

      logger.nitro(`Generated app session message for LockBlock room ${result.roomId}`);

      // Send the message to the player for signature
      const playerConnection = room.connections.get(room.player.eoa);
      if (playerConnection && playerConnection.ws.readyState === 1) {
        playerConnection.ws.send(JSON.stringify({
          type: 'appSession:signatureRequest',
          roomId: result.roomId,
          appSessionData: appSessionMessage.appSessionData,
          appDefinition: appSessionMessage.appDefinition,
          participants: appSessionMessage.participants,
          requestToSign: appSessionMessage.requestToSign
        }));
      }

    } catch (error) {
      logger.error(`Failed to generate app session message for LockBlock room ${result.roomId}:`, error);
    }
  }
}

/**
 * Handles a request to get available rooms
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} context - Application context containing roomManager
 */
export async function handleGetAvailableRooms(ws, { roomManager }) {
  // For LockBlock, we might want to show spectatable games or create new rooms
  // Since it's single-player, "available rooms" could mean rooms that can be spectated
  const availableRooms = [];

  // Get current timestamp
  const now = Date.now();

  // Iterate through all rooms and find spectatable ones
  for (const [roomId, room] of roomManager.rooms.entries()) {
    // Room is spectatable if it has a player and game is ongoing
    if (room.player.eoa && room.gameStarted && !room.gameState?.isGameOver) {
      availableRooms.push({
        roomId,
        playerAddress: room.player.eoa,
        entryDeposit: room.player.entryDeposit,
        difficulty: room.difficulty,
        gameStarted: room.gameStarted,
        createdAt: room.createdAt || now,
        currentChunk: room.gameState?.currentChunk || 0,
        playerScore: room.gameState?.player?.score || 0,
        playerLives: room.gameState?.player?.lives || 3
      });
    }
  }

  // Send available rooms to client
  ws.send(JSON.stringify({
    type: 'room:available',
    rooms: availableRooms,
    message: 'Available rooms for spectating (LockBlock is single-player)'
  }));
}