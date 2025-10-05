/**
 * Match Repository
 * Handles all Firebase operations for matches and players
 */

import { getDb, isFirebaseAvailable } from "../config/firebase";
import type { Match, Player, Garbage, ScoreEntry } from "../types/game";

export class MatchRepository {
  private readonly COLLECTION = "matches";

  /**
   * Save match to Firebase (without players array - use subcollection only)
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
        scoreThreshold: match.scoreThreshold,
        createdAt: match.createdAt,
        startedAt: match.startedAt || null,
        endedAt: match.endedAt || null,
        pausedAt: match.pausedAt || null,
        // Players stored in subcollection only - no redundant array
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
      inventory?: Garbage[];
      scoreHistory?: ScoreEntry[];
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

  /**
   * Load all matches from database
   */
  async loadAllMatches(): Promise<Match[]> {
    if (!isFirebaseAvailable()) {
      console.log("[DEV] Would load all matches from Firebase");
      return [];
    }

    try {
      const db = getDb();
      const matchesSnapshot = await db.collection(this.COLLECTION).get();
      const matches: Match[] = [];

      for (const matchDoc of matchesSnapshot.docs) {
        const matchData = matchDoc.data();
        const matchId = matchDoc.id;

        // Load players for this match
        const playersSnapshot = await db
          .collection(this.COLLECTION)
          .doc(matchId)
          .collection("players")
          .get();

        const match: Match = {
          id: matchId,
          state: matchData.state,
          adminId: matchData.adminId,
          scoreThreshold: matchData.scoreThreshold || 500, // Default to 500 if not set
          createdAt: matchData.createdAt
            ? matchData.createdAt.toDate()
            : new Date(),
          startedAt: matchData.startedAt
            ? matchData.startedAt.toDate()
            : undefined,
          pausedAt: matchData.pausedAt
            ? matchData.pausedAt.toDate()
            : undefined,
          endedAt: matchData.endedAt ? matchData.endedAt.toDate() : undefined,
        };

        matches.push(match);
      }

      console.log(`Loaded ${matches.length} matches from Firebase`);
      return matches;
    } catch (error) {
      console.error("Error loading matches from Firebase:", error);
      throw error;
    }
  }

  /**
   * Get all players for a match from sub-collection
   */
  async getPlayers(matchId: string): Promise<Player[]> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would get players for match ${matchId} from Firebase`);
      return [];
    }

    try {
      const db = getDb();
      const playersSnapshot = await db
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("players")
        .get();

      const players: Player[] = [];
      for (const playerDoc of playersSnapshot.docs) {
        const playerData = playerDoc.data();
        const player: Player = {
          id: playerData.id,
          name: playerData.name,
          role: playerData.role,
          qrCode: playerData.qrCode,
          qrCodeBase64: playerData.qrCodeBase64,
          score: playerData.score,
          shots: playerData.shots,
          state: playerData.state,
          joinedAt: playerData.joinedAt
            ? playerData.joinedAt.toDate()
            : new Date(),
          isActive: playerData.isActive,
          inventory: playerData.inventory || [],
          scoreHistory: playerData.scoreHistory || [],
        };
        players.push(player);
      }

      return players;
    } catch (error) {
      console.error("Error getting players from Firebase:", error);
      throw error;
    }
  }

  /**
   * Get a specific player from sub-collection
   */
  async getPlayer(matchId: string, playerId: string): Promise<Player | null> {
    if (!isFirebaseAvailable()) {
      console.log(
        `[DEV] Would get player ${playerId} from match ${matchId} from Firebase`
      );
      return null;
    }

    try {
      const db = getDb();
      const playerDoc = await db
        .collection(this.COLLECTION)
        .doc(matchId)
        .collection("players")
        .doc(playerId)
        .get();

      if (!playerDoc.exists) {
        return null;
      }

      const playerData = playerDoc.data();
      if (!playerData) {
        return null;
      }

      const player: Player = {
        id: playerData.id,
        name: playerData.name,
        role: playerData.role,
        qrCode: playerData.qrCode,
        qrCodeBase64: playerData.qrCodeBase64,
        score: playerData.score,
        shots: playerData.shots,
        state: playerData.state,
        joinedAt: playerData.joinedAt
          ? playerData.joinedAt.toDate()
          : new Date(),
        isActive: playerData.isActive,
        inventory: playerData.inventory || [],
        scoreHistory: playerData.scoreHistory || [],
      };

      return player;
    } catch (error) {
      console.error("Error getting player from Firebase:", error);
      throw error;
    }
  }

  /**
   * Load a specific match by ID
   */
  async loadMatch(matchId: string): Promise<Match | null> {
    if (!isFirebaseAvailable()) {
      console.log(`[DEV] Would load match ${matchId} from Firebase`);
      return null;
    }

    try {
      const db = getDb();
      const matchDoc = await db.collection(this.COLLECTION).doc(matchId).get();

      if (!matchDoc.exists) {
        return null;
      }

      const matchData = matchDoc.data();
      if (!matchData) {
        return null;
      }

      const match: Match = {
        id: matchId,
        state: matchData.state,
        adminId: matchData.adminId,
        scoreThreshold: matchData.scoreThreshold || 500, // Default to 500 if not set
        createdAt: matchData.createdAt
          ? matchData.createdAt.toDate()
          : new Date(),
        startedAt: matchData.startedAt
          ? matchData.startedAt.toDate()
          : undefined,
        pausedAt: matchData.pausedAt ? matchData.pausedAt.toDate() : undefined,
        endedAt: matchData.endedAt ? matchData.endedAt.toDate() : undefined,
      };

      console.log(`Loaded match ${matchId} from Firebase`);
      return match;
    } catch (error) {
      console.error("Error loading match from Firebase:", error);
      throw error;
    }
  }
}

// Singleton instance
export const matchRepository = new MatchRepository();
