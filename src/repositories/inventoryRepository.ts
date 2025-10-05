/**
 * Inventory Repository
 * Handles all Firebase operations for player inventory and scoring
 */

import { getDb, isFirebaseAvailable } from "../config/firebase";
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
      await db
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .collection("items")
        .doc(item.id)
        .set({
          ...item,
          pickedUpAt: item.pickedUpAt,
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
      await db
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .collection("items")
        .doc(itemId)
        .delete();

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
      const snapshot = await db
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .collection("items")
        .orderBy("pickedUpAt", "desc")
        .get();

      const items: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: data.id,
          type: data.type,
          name: data.name,
          description: data.description,
          value: data.value,
          pickedUpAt: data.pickedUpAt.toDate(),
          location: data.location,
          metadata: data.metadata,
        });
      });

      return items;
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
      await db
        .collection(this.SCORES_COLLECTION)
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .collection("scores")
        .doc(scoreEntry.id)
        .set({
          ...scoreEntry,
          timestamp: scoreEntry.timestamp,
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
      const snapshot = await db
        .collection(this.SCORES_COLLECTION)
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .collection("scores")
        .orderBy("timestamp", "desc")
        .get();

      const scores: ScoreEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        scores.push({
          id: data.id,
          type: data.type,
          points: data.points,
          description: data.description,
          timestamp: data.timestamp.toDate(),
          metadata: data.metadata,
        });
      });

      return scores;
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
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("players")
        .get();

      const result: { playerId: string; items: InventoryItem[] }[] = [];

      for (const playerDoc of playersSnapshot.docs) {
        const playerId = playerDoc.id;
        const itemsSnapshot = await playerDoc.ref
          .collection("items")
          .orderBy("pickedUpAt", "desc")
          .get();

        const items: InventoryItem[] = [];
        itemsSnapshot.forEach((itemDoc) => {
          const data = itemDoc.data();
          items.push({
            id: data.id,
            type: data.type,
            name: data.name,
            description: data.description,
            value: data.value,
            pickedUpAt: data.pickedUpAt.toDate(),
            location: data.location,
            metadata: data.metadata,
          });
        });

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

      // Clear inventory items
      const inventoryRef = db.collection(this.COLLECTION).doc(matchId);
      const playersSnapshot = await inventoryRef.collection("players").get();

      const batch = db.batch();
      for (const playerDoc of playersSnapshot.docs) {
        const itemsSnapshot = await playerDoc.ref.collection("items").get();
        itemsSnapshot.forEach((itemDoc) => {
          batch.delete(itemDoc.ref);
        });
        batch.delete(playerDoc.ref);
      }
      await batch.commit();

      // Clear score history
      const scoresRef = db.collection(this.SCORES_COLLECTION).doc(matchId);
      const scoresPlayersSnapshot = await scoresRef.collection("players").get();

      const scoresBatch = db.batch();
      for (const playerDoc of scoresPlayersSnapshot.docs) {
        const scoresSnapshot = await playerDoc.ref.collection("scores").get();
        scoresSnapshot.forEach((scoreDoc) => {
          scoresBatch.delete(scoreDoc.ref);
        });
        scoresBatch.delete(playerDoc.ref);
      }
      await scoresBatch.commit();

      console.log(`Inventory and scores cleared for match ${matchId}`);
    } catch (error) {
      console.error("Error clearing match inventory:", error);
      throw error;
    }
  }
}

// Singleton instance
export const inventoryRepository = new InventoryRepository();
