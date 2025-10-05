import WebSocket from "ws";
import http from "http";
import fs from "fs";

/**
 * Simple test script to verify websocket shot handling
 * Tests both hit and miss scenarios using real image files
 */
async function testShotHandling() {
  const serverUrl = "ws://localhost:8080/ws";
  const httpUrl = "http://localhost:8080";

  const testResults = [];

  console.log("🧪 Testing HIT scenario with hit.jpg...");
  const hitResult = await runTestScenario("hit.jpg", true); // Real hit image
  testResults.push({ name: "HIT scenario with hit.jpg", ...hitResult });

  console.log("\n🧪 Testing MISS scenario with miss.jpg...");
  const missResult = await runTestScenario("miss.jpg", false); // Real miss image
  testResults.push({ name: "MISS scenario with miss.jpg", ...missResult });

  // Display test summary
  console.log("\n📊 Test Results Summary:");
  console.log("=".repeat(50));

  let passed = 0;
  let failed = 0;

  testResults.forEach((result, index) => {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${index + 1}. ${result.name}: ${status}`);
    if (result.passed) {
      passed++;
    } else {
      failed++;
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log("=".repeat(50));
  console.log(`Total: ${testResults.length} tests, ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log("\n🎉 All tests passed!");
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed.`);
    process.exit(1);
  }

  async function runTestScenario(imageFile, shouldHit) {
    return new Promise((resolve) => {
      console.log("Creating test match via HTTP...");

      // First create a match
      const createMatchRequest = http.request(`${httpUrl}/api/match/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      createMatchRequest.write(JSON.stringify({ adminName: "Test Admin" }));

      createMatchRequest.on("response", (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const matchData = JSON.parse(data);
            console.log("Match created:", matchData);

            // The admin is already the first player, now join a second player
            joinSecondPlayer(
              matchData.matchId,
              matchData.adminId,
              imageFile,
              shouldHit,
              (result) => resolve(result), // Success callback
              (error) => resolve({ passed: false, error: error.message }) // Error callback
            );
          } catch (error) {
            console.error("Error parsing match creation response:", error);
            resolve({ passed: false, error: error.message });
          }
        });
      });

      createMatchRequest.on("error", (error) => {
        console.error("Error creating match:", error);
        resolve({ passed: false, error: error.message });
      });

      createMatchRequest.end();
    });
  }

  function joinPlayer(matchId, imageFile, shouldHit, resolve, reject) {
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
            imageFile,
            shouldHit,
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

  function joinSecondPlayer(
    matchId,
    adminId,
    imageFile,
    shouldHit,
    onSuccess,
    onError
  ) {
    console.log("Joining second player to match...");

    const joinRequest2 = http.request(`${httpUrl}/api/match/${matchId}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // For hit scenario, use the specific player ID that matches the QR code
    const playerData = shouldHit
      ? { playerName: "Test Player 2", playerId: "http://en.m.wikipedia.org" }
      : { playerName: "Test Player 2" };

    joinRequest2.write(JSON.stringify(playerData));

    joinRequest2.on("response", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const playerData2 = JSON.parse(data);
          console.log("Player 2 joined:", playerData2);

          // Now start the match via WebSocket (which will also handle the shot attempt)
          startMatch(
            matchId,
            adminId,
            imageFile,
            shouldHit,
            onSuccess,
            onError
          );
        } catch (error) {
          console.error("Error parsing second player join response:", error);
          onError(error);
        }
      });
    });

    joinRequest2.on("error", (error) => {
      console.error("Error joining second player:", error);
      onError(error);
    });

    joinRequest2.end();
  }

  function startMatch(
    matchId,
    adminId,
    imageFile,
    shouldHit,
    onSuccess,
    onError
  ) {
    console.log("Starting the match via WebSocket...");

    // Create a persistent WebSocket connection like a frontend client would
    const ws = new WebSocket(serverUrl);
    let connected = false;
    let matchStarted = false;

    ws.on("open", () => {
      console.log("Frontend client connected to websocket server");
      connected = true;

      // Connect admin to the match first
      const connectMessage = {
        type: "player:connect",
        data: {
          matchId: matchId,
          playerId: adminId,
        },
      };

      ws.send(JSON.stringify(connectMessage));
    });

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      console.log("Frontend received message:", message);

      // After connecting, send admin action to start match
      if (message.type === "match:state" && !matchStarted) {
        console.log("Admin connected, sending start match command...");

        const startMessage = {
          type: "admin:action",
          data: {
            matchId: matchId,
            adminId: adminId,
            action: "start",
          },
        };

        ws.send(JSON.stringify(startMessage));
      }

      // Listen for match started event
      if (message.type === "match:started") {
        console.log("Match started successfully");
        matchStarted = true;

        // Now send shot attempt like a frontend client would
        sendShotAttempt(ws, matchId, adminId, imageFile, shouldHit, onSuccess, onError);
      }

      // Listen for shot result broadcast
      if (message.type === "shot:result") {
        console.log("Shot result received:", message.data);
        const actualHit = message.data.hit;
        if (actualHit === shouldHit) {
          console.log(
            `✅ ${shouldHit ? "Hit" : "Miss"} scenario tested successfully!`
          );

          // Now end the match
          console.log("Ending the match...");
          const endMessage = {
            type: "admin:action",
            data: {
              matchId: matchId,
              adminId: adminId,
              action: "end",
            },
          };
          ws.send(JSON.stringify(endMessage));
        } else {
          console.log(
            `⚠️  Expected ${shouldHit ? "hit" : "miss"} but got ${
              actualHit ? "hit" : "miss"
            }`
          );
          ws.close();
          onError(new Error(`Expected ${shouldHit ? "hit" : "miss"} but got ${actualHit ? "hit" : "miss"}`));
        }
      }

      // Listen for match ended event
      if (message.type === "match:ended") {
        console.log("Match ended successfully:", message.data);
        ws.close();
        onSuccess({ passed: true });
      }

      // Handle admin action success
      if (message.type === "admin:action:success") {
        console.log("Admin action completed:", message.data);
      }

      // Handle errors
      if (message.type === "error") {
        console.error("❌ Error received:", message.data);
        ws.close();
        onError(new Error(message.data.message));
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      onError(error);
    });

    ws.on("close", () => {
      console.log("Frontend WebSocket connection closed");
    });

    // Timeout
    setTimeout(() => {
      console.log("❌ Test timed out");
      ws.close();
      onError(new Error("Test timed out"));
    }, 20000);
  }

  function sendShotAttempt(ws, matchId, playerId, imageFile, shouldHit, onSuccess, onError) {
    console.log("Sending shot attempt...");

    // Read the image file and convert to base64
    try {
      const imageBuffer = fs.readFileSync(imageFile);
      const base64Image = imageBuffer.toString("base64");

      console.log(`Loaded ${imageFile}, size: ${base64Image.length} bytes`);

      const shotMessage = {
        type: "shot:attempt",
        data: {
          matchId: matchId,
          shooterId: playerId,
          imageData: base64Image,
        },
      };

      console.log("Sending shot attempt message");
      ws.send(JSON.stringify(shotMessage));
    } catch (error) {
      console.error("Error reading image file:", error);
      onError(error);
    }
  }
}

// Run the test
testShotHandling();
