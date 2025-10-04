import WebSocket from 'ws';
import http from 'http';

/**
 * Simple test script to verify websocket shot handling
 */
async function testShotHandling() {
  const serverUrl = 'ws://localhost:8080/ws';
  const httpUrl = 'http://localhost:8080';

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
        joinPlayer(matchData.matchId);
      } catch (error) {
        console.error('Error parsing match creation response:', error);
      }
    });
  });

  createMatchRequest.on('error', (error) => {
    console.error('Error creating match:', error);
  });

  createMatchRequest.end();

  function joinPlayer(matchId) {
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
          joinSecondPlayer(matchId, playerData.playerId);
        } catch (error) {
          console.error('Error parsing player join response:', error);
        }
      });
    });

    joinRequest.on('error', (error) => {
      console.error('Error joining player:', error);
    });

    joinRequest.end();
  }

  function joinSecondPlayer(matchId, firstPlayerId) {
    console.log('Joining second player to match...');

    const joinRequest2 = http.request(`${httpUrl}/api/match/${matchId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    joinRequest2.write(JSON.stringify({ playerName: 'Test Player 2' }));

    joinRequest2.on('response', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const playerData2 = JSON.parse(data);
          console.log('Player 2 joined:', playerData2);

          // Now start the match
          startMatch(matchId, firstPlayerId);
        } catch (error) {
          console.error('Error parsing second player join response:', error);
        }
      });
    });

    joinRequest2.on('error', (error) => {
      console.error('Error joining second player:', error);
    });

    joinRequest2.end();
  }

  function startMatch(matchId, playerId) {
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
          connectAndTest(matchId, playerId);
        } catch (error) {
          console.error('Error parsing match start response:', error);
        }
      });
    });

    startRequest.on('error', (error) => {
      console.error('Error starting match:', error);
    });

    startRequest.end();
  }

  function connectAndTest(matchId, playerId) {
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

        // Create a dummy base64 image (small 1x1 pixel PNG)
        const dummyBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

        const shotMessage = {
          type: 'shot:attempt',
          data: {
            matchId: matchId,
            shooterId: playerId,
            imageData: dummyBase64Image
          }
        };

        console.log('Sending shot attempt message');
        ws.send(JSON.stringify(shotMessage));
      }

      // Listen for shot result broadcast
      if (message.type === 'shot:result') {
        console.log('Shot result received:', message.data);
        console.log('✅ Test completed successfully!');
        ws.close();
      }

      // Handle errors
      if (message.type === 'error') {
        console.error('❌ Error received:', message.data);
        ws.close();
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      process.exit(0);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('❌ Test timed out');
      ws.close();
      process.exit(1);
    }, 10000);
  }
}

// Run the test
testShotHandling().catch(console.error);