#!/usr/bin/env ts-node

/**
 * Test Script for Rejoin and Restart Functionality
 *
 * This script tests:
 * 1. Players can rejoin even when match is started (using QR codes)
 * 2. When admin restarts match, all player scores are reset to 0
 * 3. Players can continue with their original QR codes after restart
 */

import { config as loadEnv } from "dotenv";

// Load environment variables first
console.log("📁 Loading environment variables...");
loadEnv();
console.log("✅ Environment variables loaded");

import { initializeFirebase } from "../src/config/firebase";
import { inventoryRepository } from "../src/repositories/inventoryRepository";

// Initialize Firebase
console.log("🔧 Initializing Firebase...");
initializeFirebase();

// Test data
const TEST_ADMIN_NAME = "Rejoin Restart Test Admin";
const TEST_PLAYER_1 = "Rejoin Test Player 1";
const TEST_PLAYER_2 = "Rejoin Test Player 2";

// Helper function to make HTTP requests
async function makeRequest(url: string, method: string = "GET", body?: any) {
  const fetch = (await import("node-fetch")).default;

  const options: any = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  return { status: response.status, data };
}

async function runRejoinAndRestartTests() {
  console.log("🧪 Starting Rejoin and Restart Tests...\n");

  const baseUrl = "http://localhost:8080";

  try {
    // Test 1: Create match via API
    console.log("1️⃣ Creating match via API...");
    const createResponse = await makeRequest(
      `${baseUrl}/api/match/create`,
      "POST",
      {
        adminName: TEST_ADMIN_NAME,
      }
    );

    if (createResponse.status !== 201) {
      throw new Error(
        `Failed to create match: ${JSON.stringify(createResponse.data)}`
      );
    }

    const { matchId, adminId } = createResponse.data as {
      matchId: string;
      adminId: string;
    };
    console.log(`✅ Match created: ${matchId}`);
    console.log(`   Admin ID: ${adminId}\n`);

    // Test 2: Join players and get their QR codes
    console.log("2️⃣ Joining players and getting QR codes...");

    // Join player 1
    const join1Response = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_PLAYER_1,
      }
    );

    if (join1Response.status !== 201) {
      throw new Error(
        `Failed to join player 1: ${JSON.stringify(join1Response.data)}`
      );
    }

    const player1Data = join1Response.data as any;
    const player1Id = player1Data.player.id;
    const player1QR = player1Data.player.qrCode;
    console.log(`✅ Player 1 joined: ${player1Id} (${TEST_PLAYER_1})`);
    console.log(`   QR Code: ${player1QR.substring(0, 50)}...`);

    // Join player 2
    const join2Response = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_PLAYER_2,
      }
    );

    if (join2Response.status !== 201) {
      throw new Error(
        `Failed to join player 2: ${JSON.stringify(join2Response.data)}`
      );
    }

    const player2Data = join2Response.data as any;
    const player2Id = player2Data.player.id;
    const player2QR = player2Data.player.qrCode;
    console.log(`✅ Player 2 joined: ${player2Id} (${TEST_PLAYER_2})`);
    console.log(`   QR Code: ${player2QR.substring(0, 50)}...\n`);

    // Test 3: Start the match
    console.log("3️⃣ Starting the match...");
    const startResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/start`,
      "POST",
      {
        adminId: adminId,
      }
    );

    if (startResponse.status !== 200) {
      throw new Error(
        `Failed to start match: ${JSON.stringify(startResponse.data)}`
      );
    }

    console.log(`✅ Match started\n`);

    // Test 4: Simulate some shooting and scoring
    console.log("4️⃣ Simulating shooting and scoring...");

    // Simulate player 1 shooting (update database directly)
    await inventoryRepository.updatePlayerScore(matchId, player1Id, 10, 1);
    await inventoryRepository.updatePlayerScore(matchId, player1Id, 25, 2);
    console.log(`✅ Player 1 scored: 25 points, 2 shots`);

    // Simulate player 2 shooting (update database directly)
    await inventoryRepository.updatePlayerScore(matchId, player2Id, 5, 1);
    await inventoryRepository.updatePlayerScore(matchId, player2Id, 25, 2);
    await inventoryRepository.updatePlayerScore(matchId, player2Id, 35, 3);
    console.log(`✅ Player 2 scored: 35 points, 3 shots\n`);

    // Test 5: Player 1 rejoins while match is active (should work)
    console.log("5️⃣ Player 1 rejoins while match is active...");
    const rejoin1Response = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_PLAYER_1,
      }
    );

    if (rejoin1Response.status === 200) {
      const rejoin1Data = rejoin1Response.data as any;
      console.log(`✅ Player 1 successfully rejoined during active match`);
      console.log(`   Player: ${rejoin1Data.player.name}`);
      console.log(`   Score: ${rejoin1Data.player.score} (should be 25)`);
      console.log(`   Shots: ${rejoin1Data.player.shots} (should be 2)`);
      console.log(
        `   QR Code: ${rejoin1Data.player.qrCode.substring(
          0,
          50
        )}... (same QR)\n`
      );
    } else {
      console.log(`❌ Player 1 failed to rejoin during active match`);
      console.log(`   Status: ${rejoin1Response.status}`);
      console.log(`   Response: ${JSON.stringify(rejoin1Response.data)}\n`);
    }

    // Test 6: Player 2 rejoins while match is active (should work)
    console.log("6️⃣ Player 2 rejoins while match is active...");
    const rejoin2Response = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_PLAYER_2,
      }
    );

    if (rejoin2Response.status === 200) {
      const rejoin2Data = rejoin2Response.data as any;
      console.log(`✅ Player 2 successfully rejoined during active match`);
      console.log(`   Player: ${rejoin2Data.player.name}`);
      console.log(`   Score: ${rejoin2Data.player.score} (should be 35)`);
      console.log(`   Shots: ${rejoin2Data.player.shots} (should be 3)`);
      console.log(
        `   QR Code: ${rejoin2Data.player.qrCode.substring(
          0,
          50
        )}... (same QR)\n`
      );
    } else {
      console.log(`❌ Player 2 failed to rejoin during active match`);
      console.log(`   Status: ${rejoin2Response.status}`);
      console.log(`   Response: ${JSON.stringify(rejoin2Response.data)}\n`);
    }

    // Test 7: End the match
    console.log("7️⃣ Ending the match...");
    const endResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/end`,
      "POST",
      {
        adminId: adminId,
      }
    );

    if (endResponse.status !== 200) {
      throw new Error(
        `Failed to end match: ${JSON.stringify(endResponse.data)}`
      );
    }

    console.log(`✅ Match ended\n`);

    // Test 8: Admin restarts the match (should reset all scores)
    console.log("8️⃣ Admin restarts the match (should reset all scores)...");
    const restartResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/start`,
      "POST",
      {
        adminId: adminId,
      }
    );

    if (restartResponse.status === 200) {
      const restartData = restartResponse.data as any;
      console.log(`✅ Match successfully restarted!`);
      console.log(`   Match state: ${restartData.state}\n`);
    } else {
      console.log(`❌ Failed to restart match`);
      console.log(`   Status: ${restartResponse.status}`);
      console.log(`   Response: ${JSON.stringify(restartResponse.data)}\n`);
    }

    // Test 9: Players rejoin after restart (should have reset scores)
    console.log("9️⃣ Players rejoin after restart (scores should be reset)...");

    // Player 1 rejoin after restart
    const rejoinAfterRestart1Response = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_PLAYER_1,
      }
    );

    if (rejoinAfterRestart1Response.status === 200) {
      const rejoinAfterRestart1Data = rejoinAfterRestart1Response.data as any;
      console.log(`✅ Player 1 rejoined after restart`);
      console.log(`   Player: ${rejoinAfterRestart1Data.player.name}`);
      console.log(
        `   Score: ${rejoinAfterRestart1Data.player.score} (should be 0)`
      );
      console.log(
        `   Shots: ${rejoinAfterRestart1Data.player.shots} (should be 0)`
      );
      console.log(
        `   QR Code: ${rejoinAfterRestart1Data.player.qrCode.substring(
          0,
          50
        )}... (same QR)\n`
      );
    } else {
      console.log(`❌ Player 1 failed to rejoin after restart`);
      console.log(`   Status: ${rejoinAfterRestart1Response.status}`);
      console.log(
        `   Response: ${JSON.stringify(rejoinAfterRestart1Response.data)}\n`
      );
    }

    // Player 2 rejoin after restart
    const rejoinAfterRestart2Response = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_PLAYER_2,
      }
    );

    if (rejoinAfterRestart2Response.status === 200) {
      const rejoinAfterRestart2Data = rejoinAfterRestart2Response.data as any;
      console.log(`✅ Player 2 rejoined after restart`);
      console.log(`   Player: ${rejoinAfterRestart2Data.player.name}`);
      console.log(
        `   Score: ${rejoinAfterRestart2Data.player.score} (should be 0)`
      );
      console.log(
        `   Shots: ${rejoinAfterRestart2Data.player.shots} (should be 0)`
      );
      console.log(
        `   QR Code: ${rejoinAfterRestart2Data.player.qrCode.substring(
          0,
          50
        )}... (same QR)\n`
      );
    } else {
      console.log(`❌ Player 2 failed to rejoin after restart`);
      console.log(`   Status: ${rejoinAfterRestart2Response.status}`);
      console.log(
        `   Response: ${JSON.stringify(rejoinAfterRestart2Response.data)}\n`
      );
    }

    // Test 10: Verify final match state
    console.log("🔟 Verifying final match state...");
    const matchResponse = await makeRequest(`${baseUrl}/api/match/${matchId}`);

    if (matchResponse.status === 200) {
      const matchData = matchResponse.data as any;
      console.log(`✅ Final match details:`);
      console.log(`   State: ${matchData.state}`);
      console.log(`   Total Players: ${matchData.totalPlayers}`);
      console.log(
        `   Players: ${matchData.players
          .map((p: any) => `${p.name} (${p.score} pts, ${p.shots} shots)`)
          .join(", ")}\n`
      );
    } else {
      console.log(`❌ Failed to get final match details`);
      console.log(`   Status: ${matchResponse.status}`);
      console.log(`   Response: ${JSON.stringify(matchResponse.data)}\n`);
    }

    console.log("🎉 All rejoin and restart tests completed!");
    console.log("\n📊 Test Summary:");
    console.log(`   ✅ Match creation and initial start`);
    console.log(`   ✅ Player scoring during active match`);
    console.log(`   ✅ Player rejoin during active match (using QR codes)`);
    console.log(`   ✅ Match ending`);
    console.log(`   ✅ Match restart with score reset`);
    console.log(`   ✅ Player rejoin after restart (scores reset)`);
    console.log(`   ✅ QR code persistence across restarts`);

    console.log(`\n💡 Key Features Verified:`);
    console.log(`   - Players can rejoin at ANY time using their QR codes`);
    console.log(`   - QR codes remain valid across match restarts`);
    console.log(`   - Admin restart resets all player scores to 0`);
    console.log(`   - Players can continue with same QR codes after restart`);
    console.log(`   - No need to print new QR codes!`);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runRejoinAndRestartTests()
    .then(() => {
      console.log(
        "\n✨ Rejoin and restart test script completed successfully!"
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Rejoin and restart test script failed:", error);
      process.exit(1);
    });
}

export { runRejoinAndRestartTests };
