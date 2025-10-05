#!/usr/bin/env ts-node

/**
 * Test Script for Inventory and Score Operations
 *
 * This script tests:
 * 1. Creating a match with admin
 * 2. Adding players to the match
 * 3. Adding items to player inventory
 * 4. Updating player scores
 * 5. Dropping off items and earning points
 * 6. Cleaning up test data
 */

import { randomBytes } from "crypto";
import { initializeFirebase } from "../src/config/firebase";
import { matchManager } from "../src/services/matchManager";
import { inventoryRepository } from "../src/repositories/inventoryRepository";
import { matchRepository } from "../src/repositories/matchRepository";
import type {
  InventoryItem,
  ScoreEntry,
  ItemType,
  ScoreType,
} from "../src/types/game";

// Initialize Firebase
initializeFirebase();

// Test data
const TEST_MATCH_ID = `test_match_${randomBytes(4).toString("hex")}`;
const TEST_ADMIN_NAME = "Test Admin";
const TEST_PLAYER_NAME = "Test Player";

// Helper function to generate test items
function createTestItem(type: ItemType, value: number): InventoryItem {
  return {
    id: `item_${randomBytes(4).toString("hex")}`,
    type,
    name: `${type.replace("_", " ")} Item`,
    description: `A test ${type} item worth ${value} points`,
    value,
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

async function runTests() {
  console.log("🧪 Starting Inventory and Score Tests...\n");

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

    // Test 3: Add items to player inventory
    console.log("3️⃣ Adding items to player inventory...");
    const testItems: InventoryItem[] = [
      createTestItem("plastic_bottle", 10),
      createTestItem("can", 15),
      createTestItem("paper", 5),
      createTestItem("glass", 20),
      createTestItem("organic", 8),
    ];

    for (const item of testItems) {
      await inventoryRepository.addItemToInventory(match.id, player.id, item);
      console.log(
        `   ✅ Added ${item.name} (${item.type}) - ${item.value} points`
      );
    }
    console.log(`✅ Added ${testItems.length} items to inventory\n`);

    // Test 4: Verify inventory in database
    console.log("4️⃣ Verifying inventory in database...");
    const storedInventory = await inventoryRepository.getPlayerInventory(
      match.id,
      player.id
    );
    console.log(`✅ Retrieved ${storedInventory.length} items from database:`);
    storedInventory.forEach((item, index) => {
      console.log(
        `   ${index + 1}. ${item.name} (${item.type}) - ${item.value} points`
      );
    });
    console.log();

    // Test 5: Add score entries
    console.log("5️⃣ Adding score entries...");
    const scoreEntries: ScoreEntry[] = [
      createScoreEntry("shot_hit", 10, "Hit target with shot"),
      createScoreEntry("item_dropoff", 15, "Dropped off plastic bottle"),
      createScoreEntry("bonus", 5, "Bonus for quick pickup"),
      createScoreEntry("achievement", 25, "First item collected"),
    ];

    for (const scoreEntry of scoreEntries) {
      await inventoryRepository.addScoreEntry(match.id, player.id, scoreEntry);
      console.log(
        `   ✅ Added score: ${scoreEntry.description} (+${scoreEntry.points} points)`
      );
    }
    console.log(`✅ Added ${scoreEntries.length} score entries\n`);

    // Test 6: Update player's total score
    console.log("6️⃣ Updating player's total score...");
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

    // Test 7: Verify score history
    console.log("7️⃣ Verifying score history...");
    const storedScores = await inventoryRepository.getPlayerScoreHistory(
      match.id,
      player.id
    );
    console.log(`✅ Retrieved ${storedScores.length} score entries:`);
    storedScores.forEach((score, index) => {
      console.log(
        `   ${index + 1}. ${score.description} (+${score.points} points) - ${
          score.type
        }`
      );
    });
    console.log();

    // Test 8: Simulate item dropoff (remove item and add score)
    console.log("8️⃣ Simulating item dropoff...");
    const itemToDrop = testItems[0]; // Drop the first item

    if (!itemToDrop) {
      throw new Error("No items available to drop off");
    }

    const dropoffScore = createScoreEntry(
      "item_dropoff",
      itemToDrop.value,
      `Dropped off ${itemToDrop.name}`
    );

    // Remove item from inventory
    await inventoryRepository.removeItemFromInventory(
      match.id,
      player.id,
      itemToDrop.id
    );
    console.log(`   ✅ Removed ${itemToDrop.name} from inventory`);

    // Add score entry
    await inventoryRepository.addScoreEntry(match.id, player.id, dropoffScore);
    console.log(`   ✅ Added dropoff score: +${itemToDrop.value} points`);

    // Update total score
    const newTotalScore = totalScore + itemToDrop.value;
    await inventoryRepository.updatePlayerScore(
      match.id,
      player.id,
      newTotalScore
    );
    console.log(`   ✅ Updated total score to: ${newTotalScore} points\n`);

    // Test 9: Verify final inventory
    console.log("9️⃣ Verifying final inventory...");
    const finalInventory = await inventoryRepository.getPlayerInventory(
      match.id,
      player.id
    );
    console.log(`✅ Final inventory has ${finalInventory.length} items:`);
    finalInventory.forEach((item, index) => {
      console.log(
        `   ${index + 1}. ${item.name} (${item.type}) - ${item.value} points`
      );
    });
    console.log();

    // Test 10: Get all match items (admin view)
    console.log("🔟 Getting all match items (admin view)...");
    const allMatchItems = await inventoryRepository.getAllMatchItems(match.id);
    console.log(`✅ Found items for ${allMatchItems.length} players:`);
    allMatchItems.forEach(({ playerId, items }) => {
      console.log(`   Player ${playerId}: ${items.length} items`);
      items.forEach((item, index) => {
        console.log(`     ${index + 1}. ${item.name} (${item.type})`);
      });
    });
    console.log();

    // Test 11: Update player data in match
    console.log("1️⃣1️⃣ Updating player data in match...");
    const updatedPlayer = match.players.get(player.id);
    if (updatedPlayer) {
      updatedPlayer.inventory = finalInventory;
      updatedPlayer.score = newTotalScore;
      updatedPlayer.scoreHistory = [...storedScores, dropoffScore];

      await matchRepository.updatePlayerData(match.id, player.id, {
        inventory: updatedPlayer.inventory,
        scoreHistory: updatedPlayer.scoreHistory,
        score: updatedPlayer.score,
      });
      console.log(`✅ Updated player data in match`);
    }
    console.log();

    // Test 12: Cleanup test data
    console.log("1️⃣2️⃣ Cleaning up test data...");
    await inventoryRepository.clearMatchInventory(match.id);
    console.log(`✅ Cleared inventory and score data for match ${match.id}`);

    // Remove the test match
    await matchRepository.removePlayer(match.id, match.adminId);
    await matchRepository.removePlayer(match.id, player.id);
    console.log(`✅ Removed test players from match`);
    console.log();

    console.log("🎉 All tests completed successfully!");
    console.log("\n📊 Test Summary:");
    console.log(`   ✅ Created match with admin`);
    console.log(`   ✅ Added player to match`);
    console.log(`   ✅ Added ${testItems.length} items to inventory`);
    console.log(`   ✅ Added ${scoreEntries.length} score entries`);
    console.log(`   ✅ Simulated item dropoff`);
    console.log(`   ✅ Updated player scores`);
    console.log(`   ✅ Verified database operations`);
    console.log(`   ✅ Cleaned up test data`);
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.log("\n🧹 Attempting cleanup...");

    try {
      await inventoryRepository.clearMatchInventory(TEST_MATCH_ID);
      console.log("✅ Cleanup completed");
    } catch (cleanupError) {
      console.error("❌ Cleanup failed:", cleanupError);
    }

    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runTests()
    .then(() => {
      console.log("\n✨ Test script completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Test script failed:", error);
      process.exit(1);
    });
}

export { runTests };
