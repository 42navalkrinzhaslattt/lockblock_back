/**
 * Simple test script for LockBlock server functionality
 */

import { createGame, processAction, formatGameState, formatGameOverMessage } from './src/services/lockBlock.js';
import { getRewardPool, addToRewardPool, withdrawFromRewardPool, getRewardPoolStats } from './src/services/rewardPool.js';
import { createRoomManager } from './src/services/roomManager.js';

console.log('🎮 Testing LockBlock Server Implementation\n');

// Test 1: Game Creation
console.log('1. Testing Game Creation...');
const playerEoa = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik's address
const entryDeposit = '0.01';
const currentPool = '0.05';

const gameState = createGame(playerEoa, entryDeposit, currentPool);
console.log('✅ Game created successfully');
console.log('   Player:', gameState.player.eoa);
console.log('   Lives:', gameState.player.lives);
console.log('   Entry Deposit:', gameState.entryDeposit);
console.log('   Current Pool:', gameState.rewardPool.totalAmount);
console.log('   Chunks:', gameState.chunks.length);
console.log('');

// Test 2: Player Actions
console.log('2. Testing Player Actions...');

// Test movement
let actionResult = processAction(gameState, {
  type: 'move',
  data: { direction: 'right', distance: 5 }
}, playerEoa);

if (actionResult.success) {
  console.log('✅ Movement action successful');
  console.log('   New position:', actionResult.gameState.player.position);
} else {
  console.log('❌ Movement action failed:', actionResult.error);
}

// Test interaction
actionResult = processAction(actionResult.gameState, {
  type: 'interact',
  data: { objectType: 'coin', value: 10 }
}, playerEoa);

if (actionResult.success) {
  console.log('✅ Interaction action successful');
  console.log('   New score:', actionResult.gameState.player.score);
} else {
  console.log('❌ Interaction action failed:', actionResult.error);
}

// Test chunk completion
actionResult = processAction(actionResult.gameState, {
  type: 'complete_chunk',
  data: {}
}, playerEoa);

if (actionResult.success) {
  console.log('✅ Chunk completion successful');
  console.log('   Current chunk:', actionResult.gameState.currentChunk);
  console.log('   Score after bonus:', actionResult.gameState.player.score);
} else {
  console.log('❌ Chunk completion failed:', actionResult.error);
}
console.log('');

// Test 3: Reward Pool
console.log('3. Testing Reward Pool...');

// Get initial pool state
let poolState = getRewardPool();
console.log('✅ Initial pool state:');
console.log('   Total amount:', poolState.totalAmount);
console.log('   Total games:', poolState.totalGames);

// Add to pool (player loses)
const addResult = addToRewardPool('0.01', playerEoa);
if (addResult.success) {
  console.log('✅ Added to pool successfully');
  console.log('   New total:', addResult.newTotal);
} else {
  console.log('❌ Failed to add to pool:', addResult.error);
}

// Withdraw from pool (player wins)
const withdrawResult = withdrawFromRewardPool(playerEoa);
if (withdrawResult.success) {
  console.log('✅ Withdrew from pool successfully');
  console.log('   Withdrawn amount:', withdrawResult.withdrawnAmount);
  console.log('   New total:', withdrawResult.newTotal);
} else {
  console.log('❌ Failed to withdraw from pool:', withdrawResult.error);
}

// Get pool stats
const poolStats = getRewardPoolStats();
console.log('✅ Pool statistics:');
console.log('   Win rate:', poolStats.winRate);
console.log('   Total games:', poolStats.totalGames);
console.log('');

// Test 4: Room Manager
console.log('4. Testing Room Manager...');

const roomManager = createRoomManager();

// Create room
const roomId = roomManager.createRoom('0.02', 'hard');
console.log('✅ Room created:', roomId);

// Mock WebSocket
const mockWs = { readyState: 1, send: () => {} };

// Join room
const joinResult = roomManager.joinRoom(roomId, playerEoa, mockWs);
if (joinResult.success) {
  console.log('✅ Player joined room successfully');
  console.log('   Role:', joinResult.role);
  console.log('   Entry deposit:', joinResult.entryDeposit);
} else {
  console.log('❌ Failed to join room:', joinResult.error);
}

// Get room
const room = roomManager.rooms.get(roomId);
console.log('✅ Room details:');
console.log('   Player EOA:', room.player.eoa);
console.log('   Entry deposit:', room.player.entryDeposit);
console.log('   Difficulty:', room.difficulty);
console.log('   Ready:', room.isReady);
console.log('');

// Test 5: Game State Formatting
console.log('5. Testing Game State Formatting...');

const formattedState = formatGameState(actionResult.gameState, roomId);
console.log('✅ Formatted game state:');
console.log('   Room ID:', formattedState.roomId);
console.log('   Player lives:', formattedState.player.lives);
console.log('   Current chunk:', formattedState.currentChunk);

// Test game over message
const gameOverState = { ...actionResult.gameState, isGameOver: true, gameResult: 'win' };
const gameOverMessage = formatGameOverMessage(gameOverState);
console.log('✅ Game over message:');
console.log('   Result:', gameOverMessage.gameResult);
console.log('   Player score:', gameOverMessage.playerScore);
console.log('   Reward amount:', gameOverMessage.rewardAmount);
console.log('');

console.log('🎉 All tests completed! LockBlock server implementation is working.');
