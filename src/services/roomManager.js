/**
 * Room manager for the LockBlock game
 */

import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';
import { processAction } from './index.js';
import { getRewardPool, validateEntryDeposit, calculatePotentialReward } from './index.js';

/**
 * @typedef {Object} Room
 * @property {string} id - Unique room identifier
 * @property {Object} player - Single player information
 * @property {string|null} player.eoa - Player's Ethereum address
 * @property {string} player.entryDeposit - Entry deposit amount in USDC
 * @property {Map<string, Object>} connections - Map of player connections by EOA
 * @property {Object|null} gameState - Current game state
 * @property {boolean} isReady - Whether the room is ready to start
 * @property {boolean} gameStarted - Whether the game has started
 * @property {string} difficulty - Game difficulty level
 */

/**
 * @typedef {Object} RoomManager
 * @property {Map<string, Room>} rooms - Map of active rooms by ID
 * @property {Map<string, string>} addressToRoom - Map of addresses to room IDs
 */

/**
 * Creates a new room manager
 * @returns {RoomManager} Room manager instance
 */
export function createRoomManager() {
  // In-memory storage for rooms and address-to-room mapping
  const rooms = new Map();
  const addressToRoom = new Map();

  /**
   * Creates a new room
   * @param {string} entryDeposit - Entry deposit amount in USDC (default: '0.01')
   * @param {string} difficulty - Game difficulty level (default: 'normal')
   * @returns {string} Room ID
   */
  function createRoom(entryDeposit = '0.01', difficulty = 'normal') {
    const roomId = uuidv4();
    const currentPool = getRewardPool();

    rooms.set(roomId, {
      id: roomId,
      player: {
        eoa: null,
        entryDeposit: entryDeposit
      },
      connections: new Map(),
      gameState: null,
      isReady: false,
      gameStarted: false,
      difficulty: difficulty,
      rewardInfo: calculatePotentialReward(entryDeposit),
      createdAt: Date.now()
    });
    return roomId;
  }

  /**
   * Adds a player to a room
   * @param {string} roomId - Room ID
   * @param {string} eoa - Player's Ethereum address
   * @param {Object} ws - WebSocket connection
   * @returns {Object} Result with success flag and additional info
   */
  function joinRoom(roomId, eoa, ws) {
    // Format address to proper checksum format
    const formattedEoa = ethers.getAddress(eoa);

    // Check if player is already in another room
    if (addressToRoom.has(formattedEoa)) {
      return {
        success: false,
        error: 'Player already in another room'
      };
    }

    // Get the room - if roomId doesn't exist, return error
    if (!rooms.has(roomId)) {
      return {
        success: false,
        error: 'Room not found'
      };
    }

    let room = rooms.get(roomId);

    // Check if room already has a player
    if (room.player.eoa) {
      return {
        success: false,
        error: 'Room is already occupied'
      };
    }

    // Validate entry deposit
    const depositValidation = validateEntryDeposit(formattedEoa, room.player.entryDeposit);
    if (!depositValidation.success) {
      return {
        success: false,
        error: depositValidation.error
      };
    }

    // Assign player to room
    room.player.eoa = formattedEoa;

    // Store connection and map address to room
    room.connections.set(formattedEoa, { ws, role: 'player' });
    addressToRoom.set(formattedEoa, roomId);

    // Room is ready when player joins
    room.isReady = true;
    console.log(`Room ${roomId} is ready with player: ${formattedEoa}`);

    return {
      success: true,
      roomId,
      role: 'player',
      isRoomReady: true,
      entryDeposit: room.player.entryDeposit,
      rewardInfo: room.rewardInfo
    };
  }

  /**
   * Process a player action in a game
   * @param {string} roomId - Room ID
   * @param {Object} action - Player action object
   * @param {string} eoa - Player's Ethereum address
   * @returns {Object} Result with success flag and additional info
   */
  function processPlayerAction(roomId, action, eoa) {
    // Format address to proper checksum format
    const formattedEoa = ethers.getAddress(eoa);

    if (!rooms.has(roomId)) {
      return {
        success: false,
        error: 'Room not found'
      };
    }

    const room = rooms.get(roomId);

    // Check if player is in this room
    if (!room.connections.has(formattedEoa)) {
      return {
        success: false,
        error: 'Player not in this room'
      };
    }

    // Check if the game has started
    if (!room.gameState) {
      return {
        success: false,
        error: 'Game has not started'
      };
    }

    // Process the action
    const result = processAction(room.gameState, action, formattedEoa);
    if (!result.success) {
      return result;
    }

    // Update game state
    room.gameState = result.gameState;

    return {
      success: true,
      gameState: room.gameState,
      isGameOver: room.gameState.isGameOver,
      gameResult: room.gameState.gameResult
    };
  }

  /**
   * Removes a player from a room
   * @param {string} eoa - Player's Ethereum address
   * @returns {Object} Result with success flag and removed room info
   */
  function leaveRoom(eoa) {
    // Format address to proper checksum format
    const formattedEoa = ethers.getAddress(eoa);

    if (!addressToRoom.has(formattedEoa)) {
      return {
        success: false,
        error: 'Player not in any room'
      };
    }

    const roomId = addressToRoom.get(formattedEoa);
    const room = rooms.get(roomId);

    // Clean up player connections
    if (room) {
      room.connections.delete(formattedEoa);

      // Clear player from room (single player)
      if (room.player.eoa === formattedEoa) {
        room.player.eoa = null;
      }

      // Clean up room if empty (single player means room is empty)
      rooms.delete(roomId);
    }

    addressToRoom.delete(formattedEoa);

    return {
      success: true,
      roomId
    };
  }

  /**
   * Broadcasts a message to all players in a room
   * @param {string} roomId - Room ID
   * @param {string} type - Message type
   * @param {Object} data - Message data
   */
  function broadcastToRoom(roomId, type, data) {
    if (!rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    const message = JSON.stringify({ type, ...data });
    
    for (const connection of room.connections.values()) {
      if (connection.ws.readyState === 1) { // WebSocket.OPEN
        connection.ws.send(message);
      }
    }
  }

  /**
   * Closes a room and notifies all players
   * @param {string} roomId - Room ID
   */
  function closeRoom(roomId) {
    if (!rooms.has(roomId)) return;
    
    const room = rooms.get(roomId);
    
    // Remove all players from the room
    for (const eoa of room.connections.keys()) {
      addressToRoom.delete(eoa);
    }
    
    // Delete the room
    rooms.delete(roomId);
  }

  // Return public API
  return {
    rooms,
    addressToRoom,
    createRoom,
    joinRoom,
    processPlayerAction,
    leaveRoom,
    broadcastToRoom,
    closeRoom
  };
}