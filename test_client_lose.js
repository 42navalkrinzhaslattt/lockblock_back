/**
 * Test client for LockBlock server - losing scenario to test reward pool
 */

import WebSocket from 'ws';

const SERVER_URL = 'ws://localhost:8080';
const TEST_PLAYER_EOA = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik's address

console.log('🎮 Testing LockBlock Server - Losing Scenario\n');

// Create WebSocket connection
const ws = new WebSocket(SERVER_URL);

let roomId = null;
let testStep = 0;

const testSteps = [
  'Connect to server',
  'Create and join room',
  'Start game',
  'Lose all lives',
  'Verify reward pool contribution'
];

function nextStep() {
  if (testStep < testSteps.length) {
    console.log(`\n📋 Step ${testStep + 1}: ${testSteps[testStep]}`);
    testStep++;
  }
}

function sendMessage(type, payload) {
  const message = JSON.stringify({ type, payload });
  console.log(`📤 Sending: ${type}`, payload ? JSON.stringify(payload, null, 2) : '');
  ws.send(message);
}

ws.on('open', function open() {
  console.log('✅ Connected to LockBlock server');
  nextStep();
  
  // Step 1: Create and join a room
  nextStep();
  sendMessage('joinRoom', {
    eoa: TEST_PLAYER_EOA,
    entryDeposit: '0.05', // Higher entry deposit for testing
    difficulty: 'hard'
    // No roomId means create new room
  });
});

ws.on('message', function message(data) {
  try {
    const msg = JSON.parse(data);
    console.log(`📥 Received: ${msg.type}`, msg);
    
    switch (msg.type) {
      case 'room:created':
        console.log('✅ Room created successfully!');
        console.log(`   Room ID: ${msg.roomId}`);
        console.log(`   Entry Deposit: ${msg.entryDeposit}`);
        console.log(`   Potential Pool After Loss: ${msg.rewardInfo.poolAfterLoss}`);
        roomId = msg.roomId;
        break;
        
      case 'room:ready':
        console.log('✅ Room is ready!');
        console.log(`   Current Pool: ${msg.rewardInfo.currentPoolAmount}`);
        
        // Step 2: Start the game
        setTimeout(() => {
          nextStep();
          sendMessage('startGame', { roomId });
        }, 1000);
        break;
        
      case 'game:started':
        console.log('✅ Game started successfully!');
        console.log(`   Current Pool: ${msg.currentPool}`);
        
        // Step 3: Lose all lives
        setTimeout(() => {
          nextStep();
          loseAllLives();
        }, 1000);
        break;
        
      case 'room:state':
        console.log('✅ Game state updated:');
        console.log(`   Player lives: ${msg.player.lives}`);
        console.log(`   Player score: ${msg.player.score}`);
        console.log(`   Game over: ${msg.isGameOver}`);
        
        if (msg.isGameOver && msg.gameResult === 'lose') {
          console.log('💀 Player lost the game!');
        }
        break;
        
      case 'game:over':
        console.log('🎯 Game completed!');
        console.log(`   Result: ${msg.gameResult}`);
        console.log(`   Final score: ${msg.playerScore}`);
        console.log(`   Pool contribution: ${msg.poolContribution || 'N/A'}`);
        console.log(`   New pool amount: ${msg.newPoolAmount}`);
        
        if (msg.gameResult === 'lose') {
          console.log('✅ Entry deposit successfully added to reward pool!');
        }
        
        // Step 4: Test completed
        nextStep();
        console.log('\n🎉 Losing scenario test completed successfully!');
        setTimeout(() => {
          ws.close();
          process.exit(0);
        }, 2000);
        break;
        
      case 'appSession:signatureRequest':
        console.log('📝 App session signature requested (skipping for test)');
        break;
        
      case 'error':
        console.log('❌ Error received:', msg.message);
        break;
        
      default:
        console.log(`📨 Other message: ${msg.type}`);
    }
  } catch (error) {
    console.log('❌ Error parsing message:', error.message);
    console.log('Raw data:', data.toString());
  }
});

function loseAllLives() {
  console.log('💀 Losing all lives...');
  
  // Lose life 1
  setTimeout(() => {
    console.log('   💔 Losing life 1');
    sendMessage('action', {
      roomId,
      action: {
        type: 'lose_life',
        data: {}
      }
    });
  }, 500);
  
  // Lose life 2
  setTimeout(() => {
    console.log('   💔 Losing life 2');
    sendMessage('action', {
      roomId,
      action: {
        type: 'lose_life',
        data: {}
      }
    });
  }, 1500);
  
  // Lose life 3 (game over)
  setTimeout(() => {
    console.log('   💔 Losing final life (game over!)');
    sendMessage('action', {
      roomId,
      action: {
        type: 'lose_life',
        data: {}
      }
    });
  }, 2500);
}

ws.on('close', function close() {
  console.log('🔌 Disconnected from server');
});

ws.on('error', function error(err) {
  console.log('❌ WebSocket error:', err.message);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Closing connection...');
  ws.close();
  process.exit(0);
});
