/**
 * Services index - exports all service modules
 */

// Nitrolite RPC (WebSocket) client
export { 
  initializeRPCClient, 
  getRPCClient,
  NitroliteRPCClient, 
  WSStatus 
} from './nitroliteRPC.js';


// App sessions for game rooms
export {
  createAppSession,
  closeAppSession,
  getAppSession,
  hasAppSession,
  getAllAppSessions,
  generateAppSessionMessage,
  getPendingAppSessionMessage,
  addAppSessionSignature,
  createAppSessionWithSignatures
} from './appSessions.js';

// Room management
export { createRoomManager } from './roomManager.js';

// LockBlock game logic
export { createGame, processAction, formatGameState, formatGameOverMessage } from './lockBlock.js';

// Reward pool management
export {
  getRewardPool,
  addToRewardPool,
  withdrawFromRewardPool,
  getRewardPoolStats,
  resetRewardPool,
  validateEntryDeposit,
  calculatePotentialReward
} from './rewardPool.js';