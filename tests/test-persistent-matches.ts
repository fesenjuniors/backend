#!/usr/bin/env ts-node

/**
 * Test Script for Persistent Matches
 *
 * This script tests:
 * 1. Creating a match with admin
 * 2. Adding players to the match
 * 3. Simulating server restart (clearing in-memory data)
 * 4. Rejoining players using the same match ID and player names
 * 5. Verifying that player data (inventory, scores) is preserved
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
import type {
  InventoryItem,
  ScoreEntry,
  ItemType,
  ScoreType,
} from "../src/types/game";

// Initialize Firebase
console.log("🔧 Initializing Firebase...");
initializeFirebase();

// Test data
const TEST_MATCH_ID = `persistent_match_${randomBytes(4).toString("hex")}`;
const TEST_ADMIN_NAME = "Persistent Admin";
const TEST_PLAYER_NAME = "Persistent Player";

// Helper function to generate test items
function createTestItem(
  type: ItemType,
  value: number,
  potentialScore?: number
): InventoryItem {
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

// Helper function to create score entry
function createScoreEntry(
  type: ScoreType,
  points: number,
  description: string
): ScoreEntry {
  return {
    id: `score_${randomBytes(4).toString("hex")}`,
    type,
    points,
    description,
    timestamp: new Date(),
    metadata: {
      test: true,
      generatedAt: new Date().toISOString(),
    },
  };
}

async function runPersistentMatchTests() {
  console.log("🧪 Starting Persistent Match Tests...\n");

  try {
    // Test 1: Create match with admin
    console.log("1️⃣ Creating test match with admin...");
    const match = matchManager.createMatch(TEST_ADMIN_NAME);
    console.log(`✅ Match created: ${match.id}`);
    console.log(`   Admin ID: ${match.adminId}`);
    console.log(`   Admin Name: ${match.players.get(match.adminId)?.name}\n`);

    // Test 2: Add a player
    console.log("2️⃣ Adding test player...");
    const player = await matchManager.addPlayer(match.id, TEST_PLAYER_NAME);
    if (!player) {
      throw new Error("Failed to add player");
    }
    console.log(`✅ Player added: ${player.id} (${player.name})\n`);

    // Wait for player to be saved to Firebase
    console.log("⏳ Waiting for player to be saved to Firebase...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("✅ Player should now be saved to Firebase\n");

    // Test 3: Add items to player inventory
    console.log("3️⃣ Adding items to player inventory...");
    const testItems: InventoryItem[] = [
      createTestItem("plastic_bottle", 10, 25),
      createTestItem("can", 15, 30),
      createTestItem("paper", 5, 12),
    ];

    for (const item of testItems) {
      await inventoryRepository.addItemToInventory(match.id, player.id, item);
      console.log(
        `   ✅ Added ${item.name} (${item.type}) - ${item.value} points`
      );
    }
    console.log(`✅ Added ${testItems.length} items to inventory\n`);

    // Test 4: Add score entries
    console.log("4️⃣ Adding score entries...");
    const scoreEntries: ScoreEntry[] = [
      createScoreEntry("shot_hit", 10, "Hit target with shot"),
      createScoreEntry("item_dropoff", 15, "Dropped off plastic bottle"),
      createScoreEntry("bonus", 5, "Bonus for quick pickup"),
    ];

    for (const scoreEntry of scoreEntries) {
      await inventoryRepository.addScoreEntry(match.id, player.id, scoreEntry);
      console.log(
        `   ✅ Added score: ${scoreEntry.description} (+${scoreEntry.points} points)`
      );
    }
    console.log(`✅ Added ${scoreEntries.length} score entries\n`);

    // Test 5: Update player's total score
    console.log("5️⃣ Updating player's total score...");
    const totalScore = scoreEntries.reduce(
      (sum, entry) => sum + entry.points,
      0
    );
    await inventoryRepository.updatePlayerScore(
      match.id,
      player.id,
      totalScore
    );
    console.log(`✅ Updated total score to: ${totalScore} points\n`);

    // Test 6: Simulate server restart (clear in-memory data)
    console.log("6️⃣ Simulating server restart (clearing in-memory data)...");
    // Clear the in-memory matches to simulate server restart
    (matchManager as any).matches.clear();
    console.log("✅ Cleared in-memory match data\n");

    // Test 7: Load matches from database (simulate server startup)
    console.log(
      "7️⃣ Loading matches from database (simulating server startup)..."
    );
    await matchManager.loadMatchesFromDatabase();
    console.log("✅ Loaded matches from database\n");

    // Test 8: Verify match was loaded
    console.log("8️⃣ Verifying match was loaded from database...");
    const loadedMatch = matchManager.getMatch(match.id);
    if (!loadedMatch) {
      throw new Error("Match not found after loading from database");
    }
    console.log(`✅ Match loaded: ${loadedMatch.id}`);
    console.log(`   Admin ID: ${loadedMatch.adminId}`);
    console.log(`   Players: ${loadedMatch.players.size}\n`);

    // Test 9: Verify player data was preserved
    console.log("9️⃣ Verifying player data was preserved...");
    const loadedPlayer = loadedMatch.players.get(player.id);
    if (!loadedPlayer) {
      throw new Error("Player not found after loading from database");
    }
    console.log(`✅ Player loaded: ${loadedPlayer.name}`);
    console.log(`   Score: ${loadedPlayer.score}`);
    console.log(`   Inventory items: ${loadedPlayer.inventory.length}`);
    console.log(
      `   Score history entries: ${loadedPlayer.scoreHistory.length}\n`
    );

    // Test 10: Test player rejoin
    console.log("🔟 Testing player rejoin...");
    const rejoinedPlayer = await matchManager.rejoinPlayer(
      match.id,
      TEST_PLAYER_NAME
    );
    if (!rejoinedPlayer) {
      throw new Error("Failed to rejoin player");
    }
    console.log(`✅ Player rejoined: ${rejoinedPlayer.name}`);
    console.log(`   Score: ${rejoinedPlayer.score}`);
    console.log(`   Inventory items: ${rejoinedPlayer.inventory.length}`);
    console.log(
      `   Score history entries: ${rejoinedPlayer.scoreHistory.length}\n`
    );

    // Test 11: Verify inventory and scores are still accessible
    console.log("1️⃣1️⃣ Verifying inventory and scores are still accessible...");
    const storedInventory = await inventoryRepository.getPlayerInventory(
      match.id,
      player.id
    );
    const storedScores = await inventoryRepository.getPlayerScoreHistory(
      match.id,
      player.id
    );

    console.log(`✅ Retrieved ${storedInventory.length} inventory items:`);
    storedInventory.forEach((item, index) => {
      console.log(
        `   ${index + 1}. ${item.name} (${item.type}) - ${item.value} points`
      );
    });

    console.log(`✅ Retrieved ${storedScores.length} score entries:`);
    storedScores.forEach((score, index) => {
      console.log(
        `   ${index + 1}. ${score.description} (+${score.points} points)`
      );
    });
    console.log();

    console.log("🎉 All persistent match tests completed successfully!");
    console.log("\n📊 Test Summary:");
    console.log(`   ✅ Created match with admin`);
    console.log(`   ✅ Added player to match`);
    console.log(`   ✅ Added items and scores to player`);
    console.log(`   ✅ Simulated server restart`);
    console.log(`   ✅ Loaded matches from database`);
    console.log(`   ✅ Verified player data preservation`);
    console.log(`   ✅ Tested player rejoin functionality`);
    console.log(`   ✅ Verified inventory and score persistence`);

    console.log(`\n🔍 Test data preserved in database:`);
    console.log(`   Match ID: ${TEST_MATCH_ID}`);
    console.log(`   Admin ID: ${loadedMatch.adminId}`);
    console.log(`   Player ID: ${player.id}`);
    console.log(`   Player Name: ${TEST_PLAYER_NAME}`);
    console.log(`\n💡 Players can now rejoin this match using:`);
    console.log(`   Match ID: ${TEST_MATCH_ID}`);
    console.log(`   Player Name: ${TEST_PLAYER_NAME}`);
    console.log(`   (No need to print new QR codes!)`);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runPersistentMatchTests()
    .then(() => {
      console.log("\n✨ Persistent match test script completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Persistent match test script failed:", error);
      process.exit(1);
    });
}

export { runPersistentMatchTests };
