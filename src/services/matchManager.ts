import { randomBytes } from "crypto";
import type {
  Match,
  MatchState,
  Player,
  PlayerState,
  LeaderboardEntry,
} from "../types/game";
import { matchRepository } from "../repositories/matchRepository";

/**
 * In-memory match management system
 * TODO: Integrate with Firebase for persistence
 */
class MatchManager {
  private matches: Map<string, Match>;

  constructor() {
    this.matches = new Map();
  }

  /**
   * Create a new match
   */
  createMatch(): Match {
    const matchId = this.generateMatchId();
    const match: Match = {
      id: matchId,
      state: "waiting",
      players: new Map(),
      createdAt: new Date(),
    };

    this.matches.set(matchId, match);
    console.log(`Match created: ${matchId}`);

    // Save to Firebase
    matchRepository.saveMatch(match).catch((err) => {
      console.error("Failed to save match to Firebase:", err);
    });

    return match;
  }

  /**
   * Get match by ID
   */
  getMatch(matchId: string): Match | undefined {
    return this.matches.get(matchId);
  }

  /**
   * Get all matches
   */
  getAllMatches(): Match[] {
    return Array.from(this.matches.values());
  }

  /**
   * Add a player to a match
   */
  addPlayer(matchId: string, playerName: string, playerId?: string): Player | null {
    const match = this.matches.get(matchId);
    if (!match) {
      console.error(`Match not found: ${matchId}`);
      return null;
    }

    if (match.state !== "waiting") {
      console.error(`Match ${matchId} is not in waiting state`);
      return null;
    }

    const finalPlayerId = playerId || this.generatePlayerId();
    const qrCode = this.generateQrCode(matchId, finalPlayerId);

    const player: Player = {
      id: finalPlayerId,
      name: playerName,
      qrCode,
      score: 0,
      shots: 0,
      state: "connected",
      joinedAt: new Date(),
    };

    match.players.set(finalPlayerId, player);
    console.log(`Player ${finalPlayerId} (${playerName}) joined match ${matchId}`);

    // Save player to Firebase
    matchRepository.savePlayer(matchId, player).catch((err) => {
      console.error("Failed to save player to Firebase:", err);
    });

    return player;
  }

  /**
   * Remove a player from a match
   */
  removePlayer(matchId: string, playerId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    const removed = match.players.delete(playerId);
    if (removed) {
      console.log(`Player ${playerId} left match ${matchId}`);

      // Remove from Firebase
      matchRepository.removePlayer(matchId, playerId).catch((err) => {
        console.error("Failed to remove player from Firebase:", err);
      });
    }

    return removed;
  }

  /**
   * Update player state
   */
  updatePlayerState(
    matchId: string,
    playerId: string,
    state: PlayerState
  ): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    const player = match.players.get(playerId);
    if (!player) {
      return false;
    }

    player.state = state;
    console.log(`Player ${playerId} state updated to ${state}`);

    // Update Firebase
    matchRepository.updatePlayerState(matchId, playerId, state).catch((err) => {
      console.error("Failed to update player state in Firebase:", err);
    });

    return true;
  }

  /**
   * Start a match
   */
  startMatch(matchId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    if (match.state !== "waiting") {
      console.error(
        `Match ${matchId} cannot be started from state ${match.state}`
      );
      return false;
    }

    if (match.players.size < 2) {
      console.error(`Match ${matchId} needs at least 2 players to start`);
      return false;
    }

    match.state = "active";
    match.startedAt = new Date();
    console.log(`Match ${matchId} started with ${match.players.size} players`);

    // Update Firebase
    matchRepository
      .updateMatchState(matchId, "active", match.startedAt)
      .catch((err) => {
        console.error("Failed to update match state in Firebase:", err);
      });

    return true;
  }

  /**
   * End a match
   */
  endMatch(matchId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    if (match.state !== "active") {
      console.error(`Match ${matchId} is not active`);
      return false;
    }

    match.state = "ended";
    match.endedAt = new Date();
    console.log(`Match ${matchId} ended`);

    // Update Firebase
    matchRepository
      .updateMatchState(matchId, "ended", match.endedAt)
      .catch((err) => {
        console.error("Failed to update match state in Firebase:", err);
      });

    return true;
  }

  /**
   * Get leaderboard for a match
   */
  getLeaderboard(matchId: string): LeaderboardEntry[] {
    const match = this.matches.get(matchId);
    if (!match) {
      return [];
    }

    const leaderboard: LeaderboardEntry[] = Array.from(match.players.values())
      .map((player) => ({
        playerId: player.id,
        playerName: player.name,
        score: player.score,
        shots: player.shots,
      }))
      .sort((a, b) => b.score - a.score);

    return leaderboard;
  }

  /**
   * Get winner of a match
   */
  getWinner(matchId: string): LeaderboardEntry | null {
    const leaderboard = this.getLeaderboard(matchId);
    return leaderboard.length > 0 ? leaderboard[0]! : null;
  }

  /**
   * Update player score (called after successful shot)
   * TO BE USED BY SHOT PROCESSING LOGIC
   */
  updatePlayerScore(
    matchId: string,
    playerId: string,
    pointsToAdd: number
  ): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    const player = match.players.get(playerId);
    if (!player) {
      return false;
    }

    player.score += pointsToAdd;
    player.shots += 1;
    console.log(`Player ${playerId} score updated: ${player.score}`);

    // Update Firebase
    matchRepository
      .updatePlayerScore(matchId, playerId, player.score, player.shots)
      .catch((err) => {
        console.error("Failed to update player score in Firebase:", err);
      });

    return true;
  }

  /**
   * Get all players in a match
   */
  getPlayers(matchId: string): Player[] {
    const match = this.matches.get(matchId);
    if (!match) {
      return [];
    }

    return Array.from(match.players.values());
  }

  /**
   * Get a specific player
   */
  getPlayer(matchId: string, playerId: string): Player | undefined {
    const match = this.matches.get(matchId);
    if (!match) {
      return undefined;
    }

    return match.players.get(playerId);
  }

  /**
   * Generate unique match ID
   */
  private generateMatchId(): string {
    return `match_${randomBytes(8).toString("hex")}`;
  }

  /**
   * Generate unique player ID
   */
  private generatePlayerId(): string {
    return `player_${randomBytes(8).toString("hex")}`;
  }

  /**
   * Generate QR code data
   * Format: JSON string with matchId, playerId, and timestamp
   */
  private generateQrCode(matchId: string, playerId: string): string {
    const qrData = {
      matchId,
      playerId,
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(qrData);
  }

  /**
   * Validate QR code data
   * TO BE USED BY SHOT PROCESSING LOGIC
   */
  validateQrCode(qrData: string): {
    valid: boolean;
    matchId?: string;
    playerId?: string;
  } {
    try {
      const parsed = JSON.parse(qrData);
      if (!parsed.matchId || !parsed.playerId) {
        return { valid: false };
      }

      // Check if match and player exist
      const match = this.matches.get(parsed.matchId);
      if (!match) {
        return { valid: false };
      }

      const player = match.players.get(parsed.playerId);
      if (!player) {
        return { valid: false };
      }

      return {
        valid: true,
        matchId: parsed.matchId,
        playerId: parsed.playerId,
      };
    } catch (error) {
      console.error("Invalid QR code data:", error);
      return { valid: false };
    }
  }
}

// Singleton instance
export const matchManager = new MatchManager();
