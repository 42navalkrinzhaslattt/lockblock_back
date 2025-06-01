/**
 * Reward Pool Management Service
 * Manages the global reward pool for LockBlock games
 */

import { ethers } from 'ethers';
import logger from '../utils/logger.js';

// Global reward pool state
let globalRewardPool = {
  totalAmount: '0', // Total USDC in the pool
  totalGames: 0,
  totalWins: 0,
  totalLosses: 0,
  lastUpdated: Date.now()
};

/**
 * Gets the current reward pool information
 * @returns {Object} Current reward pool state
 */
export function getRewardPool() {
  return { ...globalRewardPool };
}

/**
 * Adds funds to the reward pool (when player loses)
 * @param {string} amount - Amount to add in USDC
 * @param {string} playerEoa - Player's Ethereum address
 * @returns {Object} Updated pool information
 */
export function addToRewardPool(amount, playerEoa) {
  try {
    const currentAmount = parseFloat(globalRewardPool.totalAmount);
    const addAmount = parseFloat(amount);
    
    globalRewardPool.totalAmount = (currentAmount + addAmount).toString();
    globalRewardPool.totalLosses += 1;
    globalRewardPool.totalGames += 1;
    globalRewardPool.lastUpdated = Date.now();
    
    logger.system(`Added ${amount} USDC to reward pool from player ${playerEoa}. New total: ${globalRewardPool.totalAmount}`);
    
    return {
      success: true,
      newTotal: globalRewardPool.totalAmount,
      addedAmount: amount
    };
  } catch (error) {
    logger.error('Error adding to reward pool:', error);
    return {
      success: false,
      error: 'Failed to add to reward pool'
    };
  }
}

/**
 * Withdraws funds from the reward pool (when player wins)
 * @param {string} playerEoa - Player's Ethereum address
 * @returns {Object} Withdrawal result with amount
 */
export function withdrawFromRewardPool(playerEoa) {
  try {
    const currentAmount = parseFloat(globalRewardPool.totalAmount);
    
    if (currentAmount <= 0) {
      return {
        success: false,
        error: 'No funds available in reward pool',
        withdrawnAmount: '0'
      };
    }
    
    // Player wins the entire pool
    const withdrawnAmount = globalRewardPool.totalAmount;
    globalRewardPool.totalAmount = '0';
    globalRewardPool.totalWins += 1;
    globalRewardPool.totalGames += 1;
    globalRewardPool.lastUpdated = Date.now();
    
    logger.system(`Player ${playerEoa} won ${withdrawnAmount} USDC from reward pool. Pool reset to 0.`);
    
    return {
      success: true,
      withdrawnAmount: withdrawnAmount,
      newTotal: '0'
    };
  } catch (error) {
    logger.error('Error withdrawing from reward pool:', error);
    return {
      success: false,
      error: 'Failed to withdraw from reward pool',
      withdrawnAmount: '0'
    };
  }
}

/**
 * Gets reward pool statistics
 * @returns {Object} Pool statistics
 */
export function getRewardPoolStats() {
  const winRate = globalRewardPool.totalGames > 0 ? 
    (globalRewardPool.totalWins / globalRewardPool.totalGames * 100).toFixed(2) : 0;
  
  return {
    ...globalRewardPool,
    winRate: `${winRate}%`,
    averagePoolSize: globalRewardPool.totalLosses > 0 ? 
      (parseFloat(globalRewardPool.totalAmount) / globalRewardPool.totalLosses).toFixed(4) : '0'
  };
}

/**
 * Resets the reward pool (admin function)
 * @param {string} adminEoa - Admin's Ethereum address
 * @returns {Object} Reset result
 */
export function resetRewardPool(adminEoa) {
  try {
    const previousAmount = globalRewardPool.totalAmount;
    
    globalRewardPool = {
      totalAmount: '0',
      totalGames: 0,
      totalWins: 0,
      totalLosses: 0,
      lastUpdated: Date.now()
    };
    
    logger.system(`Reward pool reset by admin ${adminEoa}. Previous amount: ${previousAmount}`);
    
    return {
      success: true,
      previousAmount: previousAmount,
      message: 'Reward pool has been reset'
    };
  } catch (error) {
    logger.error('Error resetting reward pool:', error);
    return {
      success: false,
      error: 'Failed to reset reward pool'
    };
  }
}

/**
 * Validates if a player can afford the entry deposit
 * @param {string} playerEoa - Player's Ethereum address
 * @param {string} entryDeposit - Required entry deposit amount
 * @returns {Object} Validation result
 */
export function validateEntryDeposit(playerEoa, entryDeposit) {
  // In a real implementation, this would check the player's USDC balance
  // For now, we'll assume all players can afford the entry deposit
  try {
    const depositAmount = parseFloat(entryDeposit);
    
    if (depositAmount < 0) {
      return {
        success: false,
        error: 'Invalid entry deposit amount'
      };
    }
    
    if (depositAmount === 0) {
      return {
        success: true,
        message: 'Free game - no deposit required'
      };
    }
    
    // TODO: Implement actual balance checking via blockchain
    return {
      success: true,
      message: `Entry deposit of ${entryDeposit} USDC validated`
    };
  } catch (error) {
    logger.error('Error validating entry deposit:', error);
    return {
      success: false,
      error: 'Failed to validate entry deposit'
    };
  }
}

/**
 * Calculates potential reward for a player
 * @param {string} entryDeposit - Player's entry deposit
 * @returns {Object} Potential reward information
 */
export function calculatePotentialReward(entryDeposit) {
  const currentPool = parseFloat(globalRewardPool.totalAmount);
  const deposit = parseFloat(entryDeposit);
  
  return {
    currentPoolAmount: globalRewardPool.totalAmount,
    entryDeposit: entryDeposit,
    potentialWinAmount: globalRewardPool.totalAmount,
    riskAmount: entryDeposit,
    poolAfterLoss: (currentPool + deposit).toString()
  };
}
