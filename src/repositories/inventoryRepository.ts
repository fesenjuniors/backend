/**
 * Inventory Repository
 * Handles all Firebase operations for player inventory and scoring
 */

import { getDb, isFirebaseAvailable } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";
import type { InventoryItem, ScoreEntry, Player, Garbage } from "../types/game";

export class InventoryRepository {
  /**
   * Add item to player's inventory
   */
  async addItemToInventory(
    matchId: string,
    playerId: string,
    item: Garbage
  ): Promise<void> {
    if (!isFirebaseAvailable()) return;

    try {
      const db = getDb();
      const playerRef = db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .doc(playerId);

      const itemWithId: Garbage = {
        ...item,
        id:
          item.id ??
          `garbage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };

      await playerRef.set(
        { inventory: FieldValue.arrayUnion(itemWithId) },
        { merge: true }
      );

      console.log(
        `Item ${
          itemWithId.itemName ?? itemWithId.id
        } added to player ${playerId} inventory`
      );
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

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(playerRef);
        const data = snap.data() || {};
        const current: any[] = Array.isArray(data.inventory)
          ? data.inventory
          : [];
        const updated = current.filter((it) => {
          // Support both schemas: items with `id` or `itemId`
          const candidateId = it?.id ?? it?.itemId;
          return candidateId !== itemId;
        });
        tx.update(playerRef, { inventory: updated });
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
  ): Promise<Garbage[]> {
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

      const inventory: Garbage[] = (playerDoc.data()?.inventory ||
        []) as Garbage[];
      return inventory;
    } catch (error) {
      console.error("Error fetching player inventory:", error);
      throw error;
    }
  }

  /**
   * Atomically fetch and clear player's inventory (pop semantics)
   */
  async popPlayerInventory(
    matchId: string,
    playerId: string
  ): Promise<Garbage[]> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would pop inventory for player ${playerId}`);
      return [];
    }

    try {
      const db = getDb();
      const playerRef = db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .doc(playerId);

      const popped: Garbage[] = await db.runTransaction(async (tx) => {
        const snap = await tx.get(playerRef);
        const data = snap.data() || {};
        const current: Garbage[] = Array.isArray(data.inventory)
          ? (data.inventory as Garbage[])
          : [];
        // Clear inventory
        tx.update(playerRef, { inventory: [] });
        return current;
      });

      console.log(
        `Popped ${popped.length} inventory item(s) for player ${playerId}`
      );
      return popped;
    } catch (error) {
      console.error("Error popping player inventory:", error);
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
   * Update player's total score and shots
   */
  async updatePlayerScore(
    matchId: string,
    playerId: string,
    newScore: number,
    shots?: number
  ): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(
        `[DEV] Would update player ${playerId} score to ${newScore}, shots: ${
          shots || "not provided"
        }`
      );
      return;
    }

    try {
      const db = getDb();
      const updateData: any = { score: newScore };

      if (shots !== undefined) {
        updateData.shots = shots;
      }

      await db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .update(updateData);

      console.log(
        `Player ${playerId} score updated to ${newScore}${
          shots !== undefined ? `, shots: ${shots}` : ""
        } - Database update completed`
      );

      // Verify the update by reading the document back
      const doc = await db
        .collection("matches")
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .get();

      if (doc.exists) {
        const data = doc.data();
        console.log(
          `Verification: Player ${playerId} in database - score: ${data?.score}, shots: ${data?.shots}`
        );
      }
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
