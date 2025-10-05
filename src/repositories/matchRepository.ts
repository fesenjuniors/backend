/**
 * Match Repository
 * Handles all Firebase operations for matches and players
 */

import { getDb, isFirebaseAvailable } from "../config/firebase";
import type { Match, Player } from "../types/game";

export class MatchRepository {
  private readonly COLLECTION = "matches";

  /**
   * Save match to Firebase
   */
  async saveMatch(match: Match): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log("[DEV] Would save match to Firebase:", match.id);
      return;
    }

    try {
      const db = getDb();
      const matchData = {
        id: match.id,
        adminId: match.adminId,
        state: match.state,
        createdAt: match.createdAt,
        startedAt: match.startedAt || null,
        endedAt: match.endedAt || null,
        pausedAt: match.pausedAt || null,
        players: Array.from(match.players.values()).map((player) => ({
          id: player.id,
          name: player.name,
          role: player.role,
          qrCode: player.qrCode,
          qrCodeBase64: player.qrCodeBase64,
          score: player.score,
          shots: player.shots,
          state: player.state,
          joinedAt: player.joinedAt,
          isActive: player.isActive,
          inventory: player.inventory || [],
          scoreHistory: player.scoreHistory || [],
        })),
      };

      await db.collection(this.COLLECTION).doc(match.id).set(matchData);
      console.log(`Match saved to Firebase: ${match.id}`);
    } catch (error) {
      console.error("Error saving match to Firebase:", error);
      throw error;
    }
  }

  /**
   * Update match state
   */
  async updateMatchState(
    matchId: string,
    state: string,
    timestamp?: Date
  ): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would update match ${matchId} state to ${state}`);
      return;
    }

    try {
      const db = getDb();
      const updateData: any = { state };

      if (state === "active" && timestamp) {
        updateData.startedAt = timestamp;
      } else if (state === "ended" && timestamp) {
        updateData.endedAt = timestamp;
      } else if (state === "paused" && timestamp) {
        updateData.pausedAt = timestamp;
      }

      await db.collection(this.COLLECTION).doc(matchId).update(updateData);
      console.log(`Match ${matchId} state updated to ${state}`);
    } catch (error) {
      console.error("Error updating match state:", error);
      throw error;
    }
  }

  /**
   * Save player to Firebase
   */
  async savePlayer(matchId: string, player: Player): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would save player ${player.id} to match ${matchId}`);
      return;
    }

    try {
      const db = getDb();
      const playerData = {
        id: player.id,
        name: player.name,
        role: player.role,
        qrCode: player.qrCode,
        qrCodeBase64: player.qrCodeBase64,
        score: player.score,
        shots: player.shots,
        state: player.state,
        joinedAt: player.joinedAt,
        isActive: player.isActive,
        inventory: player.inventory || [],
        scoreHistory: player.scoreHistory || [],
      };

      await db
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("players")
        .doc(player.id)
        .set(playerData);

      console.log(`Player ${player.id} saved to Firebase`);
    } catch (error) {
      console.error("Error saving player to Firebase:", error);
      throw error;
    }
  }

  /**
   * Update player state
   */
  async updatePlayerState(
    matchId: string,
    playerId: string,
    state: string
  ): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would update player ${playerId} state to ${state}`);
      return;
    }

    try {
      const db = getDb();
      await db
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .update({ state });

      console.log(`Player ${playerId} state updated to ${state}`);
    } catch (error) {
      console.error("Error updating player state:", error);
      throw error;
    }
  }

  /**
   * Update player score
   */
  async updatePlayerScore(
    matchId: string,
    playerId: string,
    score: number,
    shots: number
  ): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would update player ${playerId} score to ${score}`);
      return;
    }

    try {
      const db = getDb();
      await db
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .update({ score, shots });

      console.log(`Player ${playerId} score updated to ${score}`);
    } catch (error) {
      console.error("Error updating player score:", error);
      throw error;
    }
  }

  /**
   * Remove player from Firebase
   */
  async removePlayer(matchId: string, playerId: string): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(
        `[DEV] Would remove player ${playerId} from match ${matchId}`
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
        .delete();

      console.log(`Player ${playerId} removed from Firebase`);
    } catch (error) {
      console.error("Error removing player from Firebase:", error);
      throw error;
    }
  }

  /**
   * Update player's inventory and score history
   */
  async updatePlayerData(
    matchId: string,
    playerId: string,
    updates: {
      inventory?: any[];
      scoreHistory?: any[];
      score?: number;
    }
  ): Promise<void> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would update player ${playerId} data`);
      return;
    }

    try {
      const db = getDb();
      const updateData: any = {};

      if (updates.inventory !== undefined) {
        updateData.inventory = updates.inventory;
      }
      if (updates.scoreHistory !== undefined) {
        updateData.scoreHistory = updates.scoreHistory;
      }
      if (updates.score !== undefined) {
        updateData.score = updates.score;
      }

      await db
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .update(updateData);

      console.log(`Player ${playerId} data updated`);
    } catch (error) {
      console.error("Error updating player data:", error);
      throw error;
    }
  }
}

// Singleton instance
export const matchRepository = new MatchRepository();
