/**
 * Inventory Repository
 * Handles all Firebase operations for player inventory and scoring
 */

import { getDb, isFirebaseAvailable } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";
import type { InventoryItem, ScoreEntry, Player } from "../types/game";

export class InventoryRepository {
  private readonly COLLECTION = "inventory";
  private readonly SCORES_COLLECTION = "scores";

  /**
   * Add item to player's inventory
   */
  async addItemToInventory(
    matchId: string,
    playerId: string,
    item: InventoryItem
  ): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(
        `[DEV] Would add item ${item.id} to player ${playerId} inventory`
      );
      return;
    }

    try {
      const db = getDb();
      const playerRef = db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .doc(playerId);

      await playerRef.update({
        inventory: FieldValue.arrayUnion(item),
      });

      console.log(`Item ${item.id} added to player ${playerId} inventory`);
    } catch (error) {
      console.error("Error adding item to inventory:", error);
      throw error;
    }
  }

  /**
   * Remove item from player's inventory (when dropped off)
   */
  async removeItemFromInventory(
    matchId: string,
    playerId: string,
    itemId: string
  ): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(
        `[DEV] Would remove item ${itemId} from player ${playerId} inventory`
      );
      return;
    }

    try {
      const db = getDb();
      const playerRef = db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .doc(playerId);

      // Get current inventory, filter out the item, then update
      const playerDoc = await playerRef.get();
      const currentInventory: InventoryItem[] =
        playerDoc.data()?.inventory || [];
      const updatedInventory = currentInventory.filter(
        (item) => item.id !== itemId
      );

      await playerRef.update({
        inventory: updatedInventory,
      });

      console.log(`Item ${itemId} removed from player ${playerId} inventory`);
    } catch (error) {
      console.error("Error removing item from inventory:", error);
      throw error;
    }
  }

  /**
   * Get player's inventory
   */
  async getPlayerInventory(
    matchId: string,
    playerId: string
  ): Promise<InventoryItem[]> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would fetch inventory for player ${playerId}`);
      return [];
    }

    try {
      const db = getDb();
      const playerDoc = await db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .get();

      const inventory: InventoryItem[] = playerDoc.data()?.inventory || [];

      // Convert Firestore timestamps to Date objects
      return inventory.map((item) => ({
        ...item,
        pickedUpAt:
          item.pickedUpAt instanceof Date
            ? item.pickedUpAt
            : (item.pickedUpAt as any).toDate(),
      }));
    } catch (error) {
      console.error("Error fetching player inventory:", error);
      throw error;
    }
  }

  /**
   * Add score entry to player's score history
   */
  async addScoreEntry(
    matchId: string,
    playerId: string,
    scoreEntry: ScoreEntry
  ): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(
        `[DEV] Would add score entry ${scoreEntry.id} for player ${playerId}`
      );
      return;
    }

    try {
      const db = getDb();
      const playerRef = db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .doc(playerId);

      await playerRef.update({
        scoreHistory: FieldValue.arrayUnion(scoreEntry),
        score: FieldValue.increment(scoreEntry.points), // Increment total score
      });

      console.log(`Score entry ${scoreEntry.id} added for player ${playerId}`);
    } catch (error) {
      console.error("Error adding score entry:", error);
      throw error;
    }
  }

  /**
   * Get player's score history
   */
  async getPlayerScoreHistory(
    matchId: string,
    playerId: string
  ): Promise<ScoreEntry[]> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would fetch score history for player ${playerId}`);
      return [];
    }

    try {
      const db = getDb();
      const playerDoc = await db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .get();

      const scoreHistory: ScoreEntry[] = playerDoc.data()?.scoreHistory || [];

      // Convert Firestore timestamps to Date objects
      return scoreHistory.map((score) => ({
        ...score,
        timestamp:
          score.timestamp instanceof Date
            ? score.timestamp
            : (score.timestamp as any).toDate(),
      }));
    } catch (error) {
      console.error("Error fetching player score history:", error);
      throw error;
    }
  }

  /**
   * Update player's total score
   */
  async updatePlayerScore(
    matchId: string,
    playerId: string,
    newScore: number
  ): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would update player ${playerId} score to ${newScore}`);
      return;
    }

    try {
      const db = getDb();
      await db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .update({ score: newScore });

      console.log(`Player ${playerId} score updated to ${newScore}`);
    } catch (error) {
      console.error("Error updating player score:", error);
      throw error;
    }
  }

  /**
   * Get all items in a match (for admin dashboard)
   */
  async getAllMatchItems(matchId: string): Promise<
    {
      playerId: string;
      items: InventoryItem[];
    }[]
  > {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would fetch all items for match ${matchId}`);
      return [];
    }

    try {
      const db = getDb();
      const playersSnapshot = await db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .get();

      const result: { playerId: string; items: InventoryItem[] }[] = [];

      for (const playerDoc of playersSnapshot.docs) {
        const playerId = playerDoc.id;
        const playerData = playerDoc.data();
        const inventory: InventoryItem[] = playerData?.inventory || [];

        // Convert Firestore timestamps to Date objects
        const items = inventory.map((item) => ({
          ...item,
          pickedUpAt:
            item.pickedUpAt instanceof Date
              ? item.pickedUpAt
              : (item.pickedUpAt as any).toDate(),
        }));

        result.push({ playerId, items });
      }

      return result;
    } catch (error) {
      console.error("Error fetching all match items:", error);
      throw error;
    }
  }

  /**
   * Clear all inventory data for a match (cleanup)
   */
  async clearMatchInventory(matchId: string): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would clear inventory for match ${matchId}`);
      return;
    }

    try {
      const db = getDb();

      // Get all players in the match
      const playersSnapshot = await db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .get();

      const batch = db.batch();

      // Clear inventory and score history for each player
      for (const playerDoc of playersSnapshot.docs) {
        batch.update(playerDoc.ref, {
          inventory: [],
          scoreHistory: [],
          score: 0,
        });
      }

      await batch.commit();

      console.log(`Inventory and scores cleared for match ${matchId}`);
    } catch (error) {
      console.error("Error clearing match inventory:", error);
      throw error;
    }
  }
}

// Singleton instance
export const inventoryRepository = new InventoryRepository();
