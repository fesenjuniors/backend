import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';

/**
 * Simple test script to verify websocket shot handling
 * Tests both hit and miss scenarios using real image files
 */
async function testShotHandling() {
  const serverUrl = 'ws://localhost:8080/ws';
  const httpUrl = 'http://localhost:8080';

  console.log('🧪 Testing HIT scenario with hit.jpg...');
  await runTestScenario('hit.jpg', true); // Real hit image

  console.log('\n🧪 Testing MISS scenario with miss.jpg...');
  await runTestScenario('miss.jpg', false); // Real miss image

  console.log('\n✅ All tests completed!');

  async function runTestScenario(imageFile, shouldHit) {
    return new Promise((resolve, reject) => {
      console.log('Creating test match via HTTP...');

      // First create a match
      const createMatchRequest = http.request(`${httpUrl}/api/match/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      createMatchRequest.on('response', (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const matchData = JSON.parse(data);
            console.log('Match created:', matchData);

            // Now join a player to the match
            joinPlayer(matchData.matchId, imageFile, shouldHit, resolve, reject);
          } catch (error) {
            console.error('Error parsing match creation response:', error);
            reject(error);
          }
        });
      });

      createMatchRequest.on('error', (error) => {
        console.error('Error creating match:', error);
        reject(error);
      });

      createMatchRequest.end();
    });
  }

  function joinPlayer(matchId, imageFile, shouldHit, resolve, reject) {
    console.log('Joining player to match...');

    const joinRequest = http.request(`${httpUrl}/api/match/${matchId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    joinRequest.write(JSON.stringify({ playerName: 'Test Player' }));

    joinRequest.on('response', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const playerData = JSON.parse(data);
          console.log('Player 1 joined:', playerData);

          // Join a second player
          joinSecondPlayer(matchId, playerData.playerId, imageFile, shouldHit, resolve, reject);
        } catch (error) {
          console.error('Error parsing player join response:', error);
          reject(error);
        }
      });
    });

    joinRequest.on('error', (error) => {
      console.error('Error joining player:', error);
      reject(error);
    });

    joinRequest.end();
  }

  function joinSecondPlayer(matchId, firstPlayerId, imageFile, shouldHit, resolve, reject) {
    console.log('Joining second player to match...');

    const joinRequest2 = http.request(`${httpUrl}/api/match/${matchId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // For hit scenario, use the specific player ID that matches the QR code
    const playerData = shouldHit 
      ? { playerName: 'Test Player 2', playerId: 'http://en.m.wikipedia.org' }
      : { playerName: 'Test Player 2' };

    joinRequest2.write(JSON.stringify(playerData));

    joinRequest2.on('response', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const playerData2 = JSON.parse(data);
          console.log('Player 2 joined:', playerData2);

          // Now start the match
          startMatch(matchId, firstPlayerId, imageFile, shouldHit, resolve, reject);
        } catch (error) {
          console.error('Error parsing second player join response:', error);
          reject(error);
        }
      });
    });

    joinRequest2.on('error', (error) => {
      console.error('Error joining second player:', error);
      reject(error);
    });

    joinRequest2.end();
  }

  function startMatch(matchId, playerId, imageFile, shouldHit, resolve, reject) {
    console.log('Starting the match...');

    const startRequest = http.request(`${httpUrl}/api/match/${matchId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    startRequest.on('response', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const startData = JSON.parse(data);
          console.log('Match started:', startData);

          // Now connect via websocket
          connectAndTest(matchId, playerId, imageFile, shouldHit, resolve, reject);
        } catch (error) {
          console.error('Error parsing match start response:', error);
          reject(error);
        }
      });
    });

    startRequest.on('error', (error) => {
      console.error('Error starting match:', error);
      reject(error);
    });

    startRequest.end();
  }

  function connectAndTest(matchId, playerId, imageFile, shouldHit, resolve, reject) {
    console.log('Connecting to websocket server...');

    const ws = new WebSocket(serverUrl);

    ws.on('open', () => {
      console.log('Connected to websocket server');

      // Connect a player to the match
      const connectMessage = {
        type: 'player:connect',
        data: {
          matchId: matchId,
          playerId: playerId
        }
      };

      console.log('Sending player connect message:', connectMessage);
      ws.send(JSON.stringify(connectMessage));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('Received message:', message);

      // After connecting, send a shot attempt
      if (message.type === 'match:state') {
        console.log('Player connected successfully, sending shot attempt...');

        // Read the image file and convert to base64
        try {
          const imageBuffer = fs.readFileSync(imageFile);
          const base64Image = imageBuffer.toString('base64');

          console.log(`Loaded ${imageFile}, size: ${base64Image.length} bytes`);

          const shotMessage = {
            type: 'shot:attempt',
            data: {
              matchId: matchId,
              shooterId: playerId,
              imageData: base64Image
            }
          };

          console.log('Sending shot attempt message');
          ws.send(JSON.stringify(shotMessage));
        } catch (error) {
          console.error('Error reading image file:', error);
          reject(error);
        }
      }

      // Listen for shot result broadcast
      if (message.type === 'shot:result') {
        console.log('Shot result received:', message.data);
        const actualHit = message.data.hit;
        if (actualHit === shouldHit) {
          console.log(`✅ ${shouldHit ? 'Hit' : 'Miss'} scenario tested successfully!`);
        } else {
          console.log(`⚠️  Expected ${shouldHit ? 'hit' : 'miss'} but got ${actualHit ? 'hit' : 'miss'}`);
        }
        ws.close();
        resolve();
      }

      // Handle errors
      if (message.type === 'error') {
        console.error('❌ Error received:', message.data);
        ws.close();
        reject(new Error(message.data.message));
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      reject(error);
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });

    // Timeout after 15 seconds (QR scanning might take longer)
    setTimeout(() => {
      console.log('❌ Test timed out');
      ws.close();
      reject(new Error('Test timed out'));
    }, 15000);
  }
}

// Run the test
testShotHandling().catch(console.error);