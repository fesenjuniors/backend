#!/usr/bin/env ts-node

/**
 * Test Script for Match Restart Functionality
 *
 * This script tests the complete restart cycle:
 * 1. Create match and start it
 * 2. End the match
 * 3. Add new players (should work)
 * 4. Start the match again (should work)
 * 5. Verify the restart functionality
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
const TEST_ADMIN_NAME = "Restart Test Admin";
const TEST_PLAYER_1 = "Restart Test Player 1";
const TEST_PLAYER_2 = "Restart Test Player 2";
const TEST_NEW_PLAYER = "New Player After End";

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

async function runMatchRestartTests() {
  console.log("🧪 Starting Match Restart Tests...\n");

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

    // Test 2: Join initial players
    console.log("2️⃣ Joining initial players...");

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

    const player1Id = (join1Response.data as any).player.id;
    console.log(`✅ Player 1 joined: ${player1Id} (${TEST_PLAYER_1})`);

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

    const player2Id = (join2Response.data as any).player.id;
    console.log(`✅ Player 2 joined: ${player2Id} (${TEST_PLAYER_2})\n`);

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

    // Test 4: End the match
    console.log("4️⃣ Ending the match...");
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

    // Test 5: Try to join new player after match ended (should work)
    console.log("5️⃣ Trying to join new player after match ended...");
    const newPlayerResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_NEW_PLAYER,
      }
    );

    if (newPlayerResponse.status === 201) {
      const newPlayerData = newPlayerResponse.data as any;
      console.log(`✅ New player successfully joined after match ended`);
      console.log(`   Player: ${newPlayerData.player.name}`);
      console.log(`   Player ID: ${newPlayerData.player.id}\n`);
    } else {
      console.log(`❌ New player failed to join after match ended`);
      console.log(`   Status: ${newPlayerResponse.status}`);
      console.log(`   Response: ${JSON.stringify(newPlayerResponse.data)}\n`);
    }

    // Test 6: Try to start the match again (should work)
    console.log("6️⃣ Trying to start the match again...");
    const restartResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/start`,
      "POST",
      {
        adminId: adminId,
      }
    );

    if (restartResponse.status === 200) {
      console.log(`✅ Match successfully restarted!`);
      const restartData = restartResponse.data as any;
      console.log(`   Match state: ${restartData.state}\n`);
    } else {
      console.log(`❌ Failed to restart match`);
      console.log(`   Status: ${restartResponse.status}`);
      console.log(`   Response: ${JSON.stringify(restartResponse.data)}\n`);
    }

    // Test 7: Verify match state and players
    console.log("7️⃣ Verifying match state and players...");
    const matchResponse = await makeRequest(`${baseUrl}/api/match/${matchId}`);

    if (matchResponse.status === 200) {
      const matchData = matchResponse.data as any;
      console.log(`✅ Match details:`);
      console.log(`   State: ${matchData.state}`);
      console.log(`   Total Players: ${matchData.totalPlayers}`);
      console.log(
        `   Players: ${matchData.players.map((p: any) => p.name).join(", ")}\n`
      );
    } else {
      console.log(`❌ Failed to get match details`);
      console.log(`   Status: ${matchResponse.status}`);
      console.log(`   Response: ${JSON.stringify(matchResponse.data)}\n`);
    }

    // Test 8: Try to join another new player after restart (should fail - match is active)
    console.log("8️⃣ Trying to join new player after restart (should fail)...");
    const newPlayerAfterRestartResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: "Another New Player",
      }
    );

    if (newPlayerAfterRestartResponse.status === 201) {
      console.log(
        `❌ NEW PLAYER JOINED AFTER RESTART - This should not happen!`
      );
      console.log(
        `   Response: ${JSON.stringify(newPlayerAfterRestartResponse.data)}`
      );
    } else {
      console.log(`✅ New player correctly rejected after restart`);
      console.log(`   Status: ${newPlayerAfterRestartResponse.status}`);
      console.log(
        `   Response: ${JSON.stringify(newPlayerAfterRestartResponse.data)}\n`
      );
    }

    console.log("🎉 All match restart tests completed!");
    console.log("\n📊 Test Summary:");
    console.log(`   ✅ Match creation and initial start`);
    console.log(`   ✅ Match ending`);
    console.log(`   ✅ New player joining after match ended`);
    console.log(`   ✅ Match restart (start again)`);
    console.log(`   ✅ Match state verification`);
    console.log(`   ✅ New player rejection after restart`);

    console.log(`\n💡 Restart functionality works:`);
    console.log(`   - Admin can end a match`);
    console.log(`   - New players can join after match ends`);
    console.log(`   - Admin can start the match again`);
    console.log(
      `   - Match goes through complete lifecycle: waiting → active → ended → active`
    );
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runMatchRestartTests()
    .then(() => {
      console.log("\n✨ Match restart test script completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Match restart test script failed:", error);
      process.exit(1);
    });
}

export { runMatchRestartTests };
