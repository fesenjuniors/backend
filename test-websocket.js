// import WebSocket from "ws";
// import http from "http";

const http = require("http");
const WebSocket = require("ws");

/**
 * Simple test script to verify websocket shot handling
 * Tests both hit and miss scenarios
 */
async function testShotHandling() {
  const serverUrl = "ws://localhost:8080/ws";
  const httpUrl = "http://localhost:8080";

  console.log("🧪 Testing HIT scenario...");
  await runTestScenario(true); // Force hit

  console.log("\n🧪 Testing MISS scenario...");
  await runTestScenario(false); // Force miss

  console.log("\n✅ All tests completed!");

  async function runTestScenario(forceHit) {
    return new Promise((resolve, reject) => {
      console.log("Creating test match via HTTP...");

      // First create a match
      const createMatchRequest = http.request(`${httpUrl}/api/match/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      createMatchRequest.on("response", (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const matchData = JSON.parse(data);
            console.log("Match created:", matchData);

            // Now join a player to the match
            joinPlayer(matchData.matchId, forceHit, resolve, reject);
          } catch (error) {
            console.error("Error parsing match creation response:", error);
            reject(error);
          }
        });
      });

      createMatchRequest.on("error", (error) => {
        console.error("Error creating match:", error);
        reject(error);
      });

      createMatchRequest.end();
    });
  }

  function joinPlayer(matchId, forceHit, resolve, reject) {
    console.log("Joining player to match...");

    const joinRequest = http.request(`${httpUrl}/api/match/${matchId}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    joinRequest.write(JSON.stringify({ playerName: "Test Player" }));

    joinRequest.on("response", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const playerData = JSON.parse(data);
          console.log("Player 1 joined:", playerData);

          // Join a second player
          joinSecondPlayer(
            matchId,
            playerData.playerId,
            forceHit,
            resolve,
            reject
          );
        } catch (error) {
          console.error("Error parsing player join response:", error);
          reject(error);
        }
      });
    });

    joinRequest.on("error", (error) => {
      console.error("Error joining player:", error);
      reject(error);
    });

    joinRequest.end();
  }

  function joinSecondPlayer(matchId, firstPlayerId, forceHit, resolve, reject) {
    console.log("Joining second player to match...");

    const joinRequest2 = http.request(`${httpUrl}/api/match/${matchId}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    joinRequest2.write(JSON.stringify({ playerName: "Test Player 2" }));

    joinRequest2.on("response", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const playerData2 = JSON.parse(data);
          console.log("Player 2 joined:", playerData2);

          // Now start the match
          startMatch(matchId, firstPlayerId, forceHit, resolve, reject);
        } catch (error) {
          console.error("Error parsing second player join response:", error);
          reject(error);
        }
      });
    });

    joinRequest2.on("error", (error) => {
      console.error("Error joining second player:", error);
      reject(error);
    });

    joinRequest2.end();
  }

  function startMatch(matchId, playerId, forceHit, resolve, reject) {
    console.log("Starting the match...");

    const startRequest = http.request(`${httpUrl}/api/match/${matchId}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    startRequest.on("response", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const startData = JSON.parse(data);
          console.log("Match started:", startData);

          // Now connect via websocket
          connectAndTest(matchId, playerId, forceHit, resolve, reject);
        } catch (error) {
          console.error("Error parsing match start response:", error);
          reject(error);
        }
      });
    });

    startRequest.on("error", (error) => {
      console.error("Error starting match:", error);
      reject(error);
    });

    startRequest.end();
  }

  function connectAndTest(matchId, playerId, forceHit, resolve, reject) {
    console.log("Connecting to websocket server...");

    const ws = new WebSocket(serverUrl);

    ws.on("open", () => {
      console.log("Connected to websocket server");

      // Connect a player to the match
      const connectMessage = {
        type: "player:connect",
        data: {
          matchId: matchId,
          playerId: playerId,
        },
      };

      console.log("Sending player connect message:", connectMessage);
      ws.send(JSON.stringify(connectMessage));
    });

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      console.log("Received message:", message);

      // After connecting, send a shot attempt
      if (message.type === "match:state") {
        console.log("Player connected successfully, sending shot attempt...");

        // Get the target player ID from the match state
        const players = message.data.players;
        const targetPlayerId = players.find((p) => p.id !== playerId)?.id;

        // Create a dummy base64 image with embedded target player ID
        const dummyBase64Image = forceHit
          ? `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==_HIT_${targetPlayerId}` // Force hit with real target
          : "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==_MISS"; // Force miss

        const shotMessage = {
          type: "shot:attempt",
          data: {
            matchId: matchId,
            shooterId: playerId,
            imageData: dummyBase64Image,
          },
        };

        console.log("Sending shot attempt message");
        ws.send(JSON.stringify(shotMessage));
      }

      // Listen for shot result broadcast
      if (message.type === "shot:result") {
        console.log("Shot result received:", message.data);
        console.log(
          forceHit
            ? "✅ Hit scenario tested successfully!"
            : "✅ Miss scenario tested successfully!"
        );
        ws.close();
        resolve();
      }

      // Handle errors
      if (message.type === "error") {
        console.error("❌ Error received:", message.data);
        ws.close();
        reject(new Error(message.data.message));
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      reject(error);
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      console.log("❌ Test timed out");
      ws.close();
      reject(new Error("Test timed out"));
    }, 10000);
  }
}

// Run the test
testShotHandling().catch(console.error);
