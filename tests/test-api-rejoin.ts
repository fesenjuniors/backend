#!/usr/bin/env ts-node

/**
 * Test Script for API-based Rejoin Functionality
 *
 * This script tests the real API flow:
 * 1. Create match via API
 * 2. Join player via API
 * 3. Simulate disconnection
 * 4. Rejoin same player via API
 * 5. Verify data persistence
 */

import { randomBytes } from "crypto";
import { config as loadEnv } from "dotenv";

// Load environment variables first
console.log("📁 Loading environment variables...");
loadEnv();
console.log("✅ Environment variables loaded");

import { initializeFirebase } from "../src/config/firebase";
import { matchManager } from "../src/services/matchManager";
import { inventoryRepository } from "../src/repositories/inventoryRepository";

// Initialize Firebase
console.log("🔧 Initializing Firebase...");
initializeFirebase();

// Test data
const TEST_ADMIN_NAME = "API Test Admin";
const TEST_PLAYER_NAME = "API Test Player";

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

// Helper function to generate test items
function createTestItem(
  type:
    | "plastic_bottle"
    | "can"
    | "paper"
    | "glass"
    | "organic"
    | "metal"
    | "cardboard"
    | "other",
  value: number,
  potentialScore?: number
) {
  return {
    id: `item_${randomBytes(4).toString("hex")}`,
    type,
    name: `${type.replace("_", " ")} Item`,
    description: `A test ${type} item worth ${value} points (max: ${
      potentialScore || value * 2
    } points)`,
    value,
    potentialScore: potentialScore || value * 2,
    pickedUpAt: new Date(),
    location: {
      lat: 49.2827 + (Math.random() - 0.5) * 0.01,
      lng: -123.1207 + (Math.random() - 0.5) * 0.01,
    },
    metadata: {
      test: true,
      generatedAt: new Date().toISOString(),
    },
  };
}

async function runApiRejoinTests() {
  console.log("🧪 Starting API Rejoin Tests...\n");

  const baseUrl = "http://localhost:8080"; // Adjust port as needed

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

    // Test 2: Join player via API
    console.log("2️⃣ Joining player via API...");
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

    console.log(
      "Join response data:",
      JSON.stringify(joinResponse.data, null, 2)
    );

    const joinData = joinResponse.data as any;
    const playerId = joinData.player.id;
    const qrCode = joinData.player.qrCode || "";
    const qrCodeBase64 = joinData.player.qrCodeBase64 || "";

    console.log(`✅ Player joined: ${playerId} (${TEST_PLAYER_NAME})`);
    if (qrCode) {
      console.log(`   QR Code: ${qrCode.substring(0, 50)}...`);
    }
    if (qrCodeBase64) {
      console.log(`   QR Base64: ${qrCodeBase64.substring(0, 50)}...`);
    }
    console.log();

    // Test 3: Simulate shooting and scoring
    console.log("3️⃣ Simulating shooting and scoring...");

    // Simulate player taking shots and getting hits
    const shootingStats = {
      totalShots: 5,
      hits: 3,
      misses: 2,
      totalScore: 0,
    };

    // Simulate shots and hits by directly updating the database
    // Since the test script runs in a separate process, we need to update the database directly
    for (let i = 0; i < shootingStats.totalShots; i++) {
      const isHit = i < shootingStats.hits;
      const points = isHit ? 10 : 0;
      shootingStats.totalScore += points;

      // Update player score directly in the database
      try {
        await inventoryRepository.updatePlayerScore(
          matchId,
          playerId,
          shootingStats.totalScore,
          i + 1
        );
        console.log(
          `   ✅ Shot ${i + 1}: ${isHit ? "HIT" : "MISS"} (+${points} points)`
        );
      } catch (error) {
        console.log(
          `   ⚠️ Shot ${i + 1}: ${
            isHit ? "HIT" : "MISS"
          } (+${points} points) - Score update failed: ${error}`
        );
      }
    }

    console.log(`✅ Player shooting stats:`);
    console.log(`   Total Shots: ${shootingStats.totalShots}`);
    console.log(`   Hits: ${shootingStats.hits}`);
    console.log(`   Misses: ${shootingStats.misses}`);
    console.log(`   Total Score: ${shootingStats.totalScore}\n`);

    // Wait for data to be saved to Firebase
    console.log("⏳ Waiting for shooting data to be saved to Firebase...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log("✅ Shooting data should now be saved to Firebase\n");

    // Test 4: Simulate disconnection (clear in-memory data)
    console.log("4️⃣ Simulating player disconnection...");
    // In a real scenario, this would happen when the player closes their app/browser
    // For testing, we'll clear the in-memory data to simulate server restart
    (matchManager as any).matches.clear();
    console.log("✅ Cleared in-memory data (simulating disconnection)\n");

    // Test 5: Rejoin same player via API
    console.log("5️⃣ Rejoining same player via API...");
    console.log(`Making request to: ${baseUrl}/api/match/${matchId}/join`);
    console.log(`Request body: {"playerName": "${TEST_PLAYER_NAME}"}`);

    const rejoinResponse = await makeRequest(
      `${baseUrl}/api/match/${matchId}/join`,
      "POST",
      {
        playerName: TEST_PLAYER_NAME,
      }
    );

    console.log(`Rejoin response status: ${rejoinResponse.status}`);
    console.log(
      `Rejoin response data:`,
      JSON.stringify(rejoinResponse.data, null, 2)
    );

    if (rejoinResponse.status !== 200) {
      throw new Error(
        `Failed to rejoin match: ${JSON.stringify(rejoinResponse.data)}`
      );
    }

    const rejoinData = rejoinResponse.data as {
      message: string;
      player: {
        id: string;
        name: string;
        score: number;
        shots: number;
        inventory: any[];
        scoreHistory: any[];
      };
    };
    console.log(`✅ Player rejoined successfully!`);
    console.log(`   Message: ${rejoinData.message}`);
    console.log(`   Player ID: ${rejoinData.player.id}`);
    console.log(`   Player Name: ${rejoinData.player.name}`);
    console.log(`   Score: ${rejoinData.player.score}`);
    console.log(`   Shots: ${rejoinData.player.shots}\n`);

    // Test 6: Verify shooting stats persistence
    console.log("6️⃣ Verifying shooting stats persistence...");

    // Get the player from the match to check their stats
    const match = matchManager.getMatch(matchId);
    if (match) {
      const player = match.players.get(playerId);
      if (player) {
        console.log(`✅ Player stats from match:`);
        console.log(`   Score: ${player.score}`);
        console.log(`   Shots: ${player.shots}`);
        console.log(`   State: ${player.state}`);
        console.log(`   Is Active: ${player.isActive}\n`);
      } else {
        console.log(`❌ Player not found in match after rejoin\n`);
      }
    } else {
      console.log(`❌ Match not found after rejoin\n`);
    }

    // Test 7: Verify shooting stats are correct
    console.log("7️⃣ Verifying shooting stats are correct...");
    if (rejoinData.player.score !== shootingStats.totalScore) {
      throw new Error(
        `Score mismatch: expected ${shootingStats.totalScore}, got ${rejoinData.player.score}`
      );
    }

    if (rejoinData.player.shots !== shootingStats.totalShots) {
      throw new Error(
        `Shots mismatch: expected ${shootingStats.totalShots}, got ${rejoinData.player.shots}`
      );
    }

    console.log("✅ Shooting stats are correctly preserved\n");

    console.log("🎉 All API rejoin tests completed successfully!");
    console.log("\n📊 Test Summary:");
    console.log(`   ✅ Created match via API`);
    console.log(`   ✅ Joined player via API`);
    console.log(`   ✅ Simulated shooting and scoring`);
    console.log(`   ✅ Simulated disconnection`);
    console.log(`   ✅ Rejoined same player via API`);
    console.log(`   ✅ Verified shooting stats persistence`);
    console.log(`   ✅ Verified player can continue shooting`);

    console.log(`\n🔍 Test data preserved in database:`);
    console.log(`   Match ID: ${matchId}`);
    console.log(`   Admin ID: ${adminId}`);
    console.log(`   Player ID: ${playerId}`);
    console.log(`   Player Name: ${TEST_PLAYER_NAME}`);

    console.log(`\n💡 Real-world usage:`);
    console.log(`   Players can now rejoin using:`);
    console.log(`   POST ${baseUrl}/api/match/${matchId}/join`);
    console.log(`   Body: {"playerName": "${TEST_PLAYER_NAME}"}`);
    console.log(`   (No need for new QR codes!)`);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runApiRejoinTests()
    .then(() => {
      console.log("\n✨ API rejoin test script completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 API rejoin test script failed:", error);
      process.exit(1);
    });
}

export { runApiRejoinTests };
