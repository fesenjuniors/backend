/**
 * Shot Repository
 * Handles all Firebase operations for shot logs
 */

import { getDb, isFirebaseAvailable } from "../config/firebase";

export interface ShotLog {
  shotId: string;
  matchId: string;
  shooterId: string;
  targetId: string | null; // null if miss or failed scan
  hit: boolean;
  timestamp: Date;
}

export class ShotRepository {
  private readonly COLLECTION = "matchLogs";

  /**
   * Save shot log to Firebase
   */
  async saveShotLog(shotLog: ShotLog): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log("[DEV] Would save shot log to Firebase:", shotLog.shotId);
      return;
    }

    try {
      const db = getDb();
      const shotData = {
        shotId: shotLog.shotId,
        shooterId: shotLog.shooterId,
        targetId: shotLog.targetId,
        hit: shotLog.hit,
        timestamp: shotLog.timestamp,
      };

      await db
        .collection(this.COLLECTION)
        .doc(shotLog.matchId)
        .collection("shots")
        .doc(shotLog.shotId)
        .set(shotData);

      console.log(`Shot log saved to Firebase: ${shotLog.shotId}`);
    } catch (error) {
      console.error("Error saving shot log to Firebase:", error);
      throw error;
    }
  }

  /**
   * Get all shot logs for a match
   */
  async getShotLogs(matchId: string): Promise<ShotLog[]> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would fetch shot logs for match ${matchId}`);
      return [];
    }

    try {
      const db = getDb();
      const snapshot = await db
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("shots")
        .orderBy("timestamp", "desc")
        .get();

      const shotLogs: ShotLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        shotLogs.push({
          shotId: data.shotId,
          matchId,
          shooterId: data.shooterId,
          targetId: data.targetId,
          hit: data.hit,
          timestamp: data.timestamp.toDate(),
        });
      });

      return shotLogs;
    } catch (error) {
      console.error("Error fetching shot logs from Firebase:", error);
      throw error;
    }
  }

  /**
   * Get shot logs for a specific player (as shooter)
   */
  async getPlayerShotLogs(
    matchId: string,
    playerId: string
  ): Promise<ShotLog[]> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would fetch shot logs for player ${playerId}`);
      return [];
    }

    try {
      const db = getDb();
      const snapshot = await db
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("shots")
        .where("shooterId", "==", playerId)
        .orderBy("timestamp", "desc")
        .get();

      const shotLogs: ShotLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        shotLogs.push({
          shotId: data.shotId,
          matchId,
          shooterId: data.shooterId,
          targetId: data.targetId,
          hit: data.hit,
          timestamp: data.timestamp.toDate(),
        });
      });

      return shotLogs;
    } catch (error) {
      console.error("Error fetching player shot logs from Firebase:", error);
      throw error;
    }
  }
}

// Singleton instance
export const shotRepository = new ShotRepository();
