/**
 * Simple WebSocket client to test LockBlock server functionality
 */

import WebSocket from 'ws';

const SERVER_URL = 'ws://localhost:8080';
const TEST_PLAYER_EOA = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik's address

console.log('🎮 Testing LockBlock Server via WebSocket\n');

// Create WebSocket connection
const ws = new WebSocket(SERVER_URL);

let roomId = null;
let testStep = 0;

const testSteps = [
  'Connect to server',
  'Create and join room',
  'Start game',
  'Perform player actions',
  'Complete game'
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
    entryDeposit: '0.02',
    difficulty: 'normal'
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
        console.log(`   Role: ${msg.role}`);
        console.log(`   Entry Deposit: ${msg.entryDeposit}`);
        roomId = msg.roomId;
        break;
        
      case 'room:ready':
        console.log('✅ Room is ready!');
        console.log(`   Player: ${msg.playerEoa}`);
        console.log(`   Entry Deposit: ${msg.entryDeposit}`);
        
        // Step 2: Start the game
        setTimeout(() => {
          nextStep();
          sendMessage('startGame', { roomId });
        }, 1000);
        break;
        
      case 'game:started':
        console.log('✅ Game started successfully!');
        console.log(`   Player: ${msg.playerEoa}`);
        console.log(`   Current Pool: ${msg.currentPool}`);
        
        // Step 3: Perform player actions
        setTimeout(() => {
          nextStep();
          performPlayerActions();
        }, 1000);
        break;
        
      case 'room:state':
        console.log('✅ Game state updated:');
        console.log(`   Player position: (${msg.player.position.x}, ${msg.player.position.y})`);
        console.log(`   Player lives: ${msg.player.lives}`);
        console.log(`   Player score: ${msg.player.score}`);
        console.log(`   Current chunk: ${msg.currentChunk}`);
        console.log(`   Game over: ${msg.isGameOver}`);
        break;
        
      case 'game:over':
        console.log('🎉 Game completed!');
        console.log(`   Result: ${msg.gameResult}`);
        console.log(`   Final score: ${msg.playerScore}`);
        console.log(`   Reward amount: ${msg.rewardAmount}`);
        console.log(`   Pool change: ${msg.poolChange}`);
        
        // Step 4: Test completed
        nextStep();
        console.log('\n🎉 All tests completed successfully!');
        setTimeout(() => {
          ws.close();
          process.exit(0);
        }, 2000);
        break;
        
      case 'appSession:signatureRequest':
        console.log('📝 App session signature requested');
        console.log('   (In a real client, this would prompt user to sign)');
        // For testing, we'll skip the signature process
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

function performPlayerActions() {
  console.log('🎮 Performing player actions...');
  
  // Action 1: Move right
  setTimeout(() => {
    console.log('   → Moving right');
    sendMessage('action', {
      roomId,
      action: {
        type: 'move',
        data: { direction: 'right', distance: 3 }
      }
    });
  }, 500);
  
  // Action 2: Collect a coin
  setTimeout(() => {
    console.log('   💰 Collecting coin');
    sendMessage('action', {
      roomId,
      action: {
        type: 'interact',
        data: { objectType: 'coin', value: 15 }
      }
    });
  }, 1500);
  
  // Action 3: Jump
  setTimeout(() => {
    console.log('   🦘 Jumping');
    sendMessage('action', {
      roomId,
      action: {
        type: 'jump',
        data: {}
      }
    });
  }, 2500);
  
  // Action 4: Collect a gem
  setTimeout(() => {
    console.log('   💎 Collecting gem');
    sendMessage('action', {
      roomId,
      action: {
        type: 'interact',
        data: { objectType: 'gem', value: 20 }
      }
    });
  }, 3500);
  
  // Action 5: Complete first chunk
  setTimeout(() => {
    console.log('   🏁 Completing chunk');
    sendMessage('action', {
      roomId,
      action: {
        type: 'complete_chunk',
        data: {}
      }
    });
  }, 4500);
  
  // Action 6: Complete second chunk
  setTimeout(() => {
    console.log('   🏁 Completing second chunk');
    sendMessage('action', {
      roomId,
      action: {
        type: 'complete_chunk',
        data: {}
      }
    });
  }, 5500);
  
  // Action 7: Complete final chunk (win the game)
  setTimeout(() => {
    console.log('   🏆 Completing final chunk (winning!)');
    sendMessage('action', {
      roomId,
      action: {
        type: 'complete_chunk',
        data: {}
      }
    });
  }, 6500);
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
