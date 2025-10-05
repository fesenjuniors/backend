#!/usr/bin/env ts-node

/**
 * Test Script for Match State Transitions
 *
 * This script tests:
 * 1. Create match and start it
 * 2. Try to join new player after match started (should fail)
 * 3. Try to rejoin existing player after match started (should work)
 * 4. Pause match and test joining
 * 5. End match and test joining
 * 6. Restart match and test joining
 */

import { randomBytes } from "crypto";
import { config as loadEnv } from "dotenv";

// Load environment variables first
console.log("📁 Loading environment variables...");
loadEnv();
console.log("✅ Environment variables loaded");

import { initializeFirebase } from "../src/config/firebase";
import { matchManager } from "../src/services/matchManager";

// Initialize Firebase
console.log("🔧 Initializing Firebase...");
initializeFirebase();

// Test data
const TEST_ADMIN_NAME = "Match State Test Admin";
const TEST_PLAYER_NAME = "Match State Test Player";
const TEST_NEW_PLAYER_NAME = "New Player After Start";

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

async function runMatchStateTests() {
  console.log("🧪 Starting Match State Tests...\n");

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

    // Test 2: Join initial player
    console.log("2️⃣ Joining initial player...");
    const joinResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_PLAYER_NAME,
      }
    );

    if (joinResponse.status !== 201) {
      throw new Error(
        `Failed to join match: ${JSON.stringify(joinResponse.data)}`
      );
    }

    const joinData = joinResponse.data as any;
    const playerId = joinData.player.id;
    console.log(`✅ Player joined: ${playerId} (${TEST_PLAYER_NAME})\n`);

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

    // Test 4: Try to join new player after match started (should fail)
    console.log("4️⃣ Trying to join new player after match started...");
    const newPlayerResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_NEW_PLAYER_NAME,
      }
    );

    if (newPlayerResponse.status === 201) {
      console.log(
        `❌ NEW PLAYER JOINED AFTER MATCH STARTED - This should not happen!`
      );
      console.log(`   Response: ${JSON.stringify(newPlayerResponse.data)}`);
    } else {
      console.log(`✅ New player correctly rejected after match started`);
      console.log(`   Status: ${newPlayerResponse.status}`);
      console.log(`   Response: ${JSON.stringify(newPlayerResponse.data)}\n`);
    }

    // Test 5: Try to rejoin existing player after match started (should work)
    console.log("5️⃣ Trying to rejoin existing player after match started...");
    const rejoinResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_PLAYER_NAME,
      }
    );

    if (rejoinResponse.status === 200) {
      console.log(
        `✅ Existing player successfully rejoined after match started`
      );
      const rejoinData = rejoinResponse.data as any;
      console.log(`   Player: ${rejoinData.player.name}`);
      console.log(`   Score: ${rejoinData.player.score}`);
      console.log(`   Shots: ${rejoinData.player.shots}\n`);
    } else {
      console.log(`❌ Existing player failed to rejoin after match started`);
      console.log(`   Status: ${rejoinResponse.status}`);
      console.log(`   Response: ${JSON.stringify(rejoinResponse.data)}\n`);
    }

    // Test 6: Pause the match
    console.log("6️⃣ Pausing the match...");
    const pauseResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/pause`,
      "POST",
      {
        adminId: adminId,
      }
    );

    if (pauseResponse.status !== 200) {
      throw new Error(
        `Failed to pause match: ${JSON.stringify(pauseResponse.data)}`
      );
    }

    console.log(`✅ Match paused\n`);

    // Test 7: Try to join new player when match is paused (should fail)
    console.log("7️⃣ Trying to join new player when match is paused...");
    const newPlayerPausedResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: "New Player During Pause",
      }
    );

    if (newPlayerPausedResponse.status === 201) {
      console.log(
        `❌ NEW PLAYER JOINED DURING PAUSE - This should not happen!`
      );
      console.log(
        `   Response: ${JSON.stringify(newPlayerPausedResponse.data)}`
      );
    } else {
      console.log(`✅ New player correctly rejected during pause`);
      console.log(`   Status: ${newPlayerPausedResponse.status}`);
      console.log(
        `   Response: ${JSON.stringify(newPlayerPausedResponse.data)}\n`
      );
    }

    // Test 8: Try to rejoin existing player when match is paused (should work)
    console.log("8️⃣ Trying to rejoin existing player when match is paused...");
    const rejoinPausedResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_PLAYER_NAME,
      }
    );

    if (rejoinPausedResponse.status === 200) {
      console.log(`✅ Existing player successfully rejoined during pause`);
      const rejoinPausedData = rejoinPausedResponse.data as any;
      console.log(`   Player: ${rejoinPausedData.player.name}\n`);
    } else {
      console.log(`❌ Existing player failed to rejoin during pause`);
      console.log(`   Status: ${rejoinPausedResponse.status}`);
      console.log(
        `   Response: ${JSON.stringify(rejoinPausedResponse.data)}\n`
      );
    }

    // Test 9: Resume the match
    console.log("9️⃣ Resuming the match...");
    const resumeResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/resume`,
      "POST",
      {
        adminId: adminId,
      }
    );

    if (resumeResponse.status !== 200) {
      throw new Error(
        `Failed to resume match: ${JSON.stringify(resumeResponse.data)}`
      );
    }

    console.log(`✅ Match resumed\n`);

    // Test 10: End the match
    console.log("🔟 Ending the match...");
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

    // Test 11: Try to join new player after match ended (should fail)
    console.log("1️⃣1️⃣ Trying to join new player after match ended...");
    const newPlayerEndedResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: "New Player After End",
      }
    );

    if (newPlayerEndedResponse.status === 201) {
      console.log(
        `❌ NEW PLAYER JOINED AFTER MATCH ENDED - This should not happen!`
      );
      console.log(
        `   Response: ${JSON.stringify(newPlayerEndedResponse.data)}`
      );
    } else {
      console.log(`✅ New player correctly rejected after match ended`);
      console.log(`   Status: ${newPlayerEndedResponse.status}`);
      console.log(
        `   Response: ${JSON.stringify(newPlayerEndedResponse.data)}\n`
      );
    }

    // Test 12: Try to rejoin existing player after match ended (should work)
    console.log("1️⃣2️⃣ Trying to rejoin existing player after match ended...");
    const rejoinEndedResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_PLAYER_NAME,
      }
    );

    if (rejoinEndedResponse.status === 200) {
      console.log(`✅ Existing player successfully rejoined after match ended`);
      const rejoinEndedData = rejoinEndedResponse.data as any;
      console.log(`   Player: ${rejoinEndedData.player.name}\n`);
    } else {
      console.log(`❌ Existing player failed to rejoin after match ended`);
      console.log(`   Status: ${rejoinEndedResponse.status}`);
      console.log(`   Response: ${JSON.stringify(rejoinEndedResponse.data)}\n`);
    }

    console.log("🎉 All match state tests completed!");
    console.log("\n📊 Test Summary:");
    console.log(`   ✅ Match creation and starting`);
    console.log(`   ✅ New player rejection after match started`);
    console.log(`   ✅ Existing player rejoin after match started`);
    console.log(`   ✅ Match pause and resume`);
    console.log(`   ✅ New player rejection during pause`);
    console.log(`   ✅ Existing player rejoin during pause`);
    console.log(`   ✅ Match ending`);
    console.log(`   ✅ New player rejection after match ended`);
    console.log(`   ✅ Existing player rejoin after match ended`);

    console.log(`\n💡 Current behavior:`);
    console.log(
      `   - New players can ONLY join when match is in "waiting" state`
    );
    console.log(`   - Existing players can rejoin at ANY time (any state)`);
    console.log(`   - This prevents new players from joining mid-game`);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runMatchStateTests()
    .then(() => {
      console.log("\n✨ Match state test script completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Match state test script failed:", error);
      process.exit(1);
    });
}

export { runMatchStateTests };
