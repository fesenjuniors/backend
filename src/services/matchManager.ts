import { randomBytes } from "crypto";
const QRCode = require("qrcode");
import type {
  Match,
  MatchState,
  Player,
  PlayerState,
  PlayerRole,
  LeaderboardEntry,
  QrCodeData,
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
   * Create a new match with admin
   */
  createMatch(adminName: string): Match {
    try {
      // Validate input
      if (!adminName || typeof adminName !== "string") {
        throw new Error("Admin name is required and must be a string");
      }

      const matchId = this.generateMatchId();
      const adminId = this.generatePlayerId();

      const match: Match = {
        id: matchId,
        state: "waiting",
        players: new Map(),
        adminId,
        createdAt: new Date(),
      };

      // Create admin player
      const adminPlayer: Player = {
        id: adminId,
        isActive: true,
        name: adminName.trim(),
        qrCode: "",
        qrCodeBase64: "",
        score: 0,
        shots: 0,
        state: "connected",
        role: "admin",
        joinedAt: new Date(),
      };

      // Generate QR code for admin (async, non-blocking)
      this.generateQrCodeForPlayer(matchId, adminId)
        .then((qrData) => {
          adminPlayer.qrCode = qrData.json;
          adminPlayer.qrCodeBase64 = qrData.base64;
        })
        .catch((err) => {
          console.error("Failed to generate QR code for admin:", err);
          // Set fallback QR code
          adminPlayer.qrCode = JSON.stringify({
            matchId,
            playerId: adminId,
            timestamp: new Date().toISOString(),
          });
          adminPlayer.qrCodeBase64 = "";
        });

      match.players.set(adminId, adminPlayer);
      this.matches.set(matchId, match);

      console.log(`Match created: ${matchId} with admin: ${adminName}`);

      // Save to Firebase (async, non-blocking)
      matchRepository.saveMatch(match).catch((err) => {
        console.error("Failed to save match to Firebase:", err);
      });

      return match;
    } catch (error) {
      console.error("Error creating match:", error);
      throw error;
    }
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
  async addPlayer(matchId: string, playerName: string): Promise<Player | null> {
    try {
      // Validate inputs
      if (!matchId || typeof matchId !== "string") {
        throw new Error("Invalid matchId");
      }

      if (!playerName || typeof playerName !== "string") {
        throw new Error("Invalid playerName");
      }

      const match = this.matches.get(matchId);
      if (!match) {
        console.error(`Match not found: ${matchId}`);
        return null;
      }

      if (match.state !== "waiting") {
        console.error(
          `Match ${matchId} is not in waiting state (current: ${match.state})`
        );
        return null;
      }

      // Check if player name already exists in match
      const existingPlayer = Array.from(match.players.values()).find(
        (p) => p.name.toLowerCase() === playerName.trim().toLowerCase()
      );

      if (existingPlayer) {
        console.error(
          `Player name "${playerName}" already exists in match ${matchId}`
        );
        return null;
      }

      const playerId = this.generatePlayerId();

      // Generate QR code for player
      let qrData;
      try {
        qrData = await this.generateQrCodeForPlayer(matchId, playerId);
      } catch (error) {
        console.error("Failed to generate QR code for player:", error);
        // Create fallback QR code
        qrData = {
          json: JSON.stringify({
            matchId,
            playerId,
            timestamp: new Date().toISOString(),
          }),
          base64: "",
        };
      }

      const player: Player = {
        id: playerId,
        isActive: true,
        name: playerName.trim(),
        qrCode: qrData.json,
        qrCodeBase64: qrData.base64,
        score: 0,
        shots: 0,
        state: "connected",
        role: "player",
        joinedAt: new Date(),
      };

      match.players.set(playerId, player);
      console.log(`Player ${playerId} (${playerName}) joined match ${matchId}`);

      // Save player to Firebase (async, non-blocking)
      matchRepository.savePlayer(matchId, player).catch((err) => {
        console.error("Failed to save player to Firebase:", err);
      });

      return player;
    } catch (error) {
      console.error("Error adding player to match:", error);
      return null;
    }
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
   * Start a match (admin only)
   */
  startMatch(matchId: string, adminId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    if (match.adminId !== adminId) {
      console.error(`Only admin can start match ${matchId}`);
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
   * Pause a match (admin only)
   */
  pauseMatch(matchId: string, adminId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    if (match.adminId !== adminId) {
      console.error(`Only admin can pause match ${matchId}`);
      return false;
    }

    if (match.state !== "active") {
      console.error(`Match ${matchId} is not active`);
      return false;
    }

    match.state = "paused";
    match.pausedAt = new Date();
    console.log(`Match ${matchId} paused`);

    // Update Firebase
    matchRepository
      .updateMatchState(matchId, "paused", match.pausedAt)
      .catch((err) => {
        console.error("Failed to update match state in Firebase:", err);
      });

    return true;
  }

  /**
   * Resume a match (admin only)
   */
  resumeMatch(matchId: string, adminId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    if (match.adminId !== adminId) {
      console.error(`Only admin can resume match ${matchId}`);
      return false;
    }

    if (match.state !== "paused") {
      console.error(`Match ${matchId} is not paused`);
      return false;
    }

    match.state = "active";
    console.log(`Match ${matchId} resumed`);

    // Update Firebase
    matchRepository.updateMatchState(matchId, "active").catch((err) => {
      console.error("Failed to update match state in Firebase:", err);
    });

    return true;
  }

  /**
   * End a match (admin only)
   */
  endMatch(matchId: string, adminId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    if (match.adminId !== adminId) {
      console.error(`Only admin can end match ${matchId}`);
      return false;
    }

    if (match.state === "ended") {
      console.error(`Match ${matchId} is already ended`);
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
        rank: 0,
        hits: 0,
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
   * Generate QR code for a player
   * Returns both JSON string and Base64 encoded QR image
   */
  private async generateQrCodeForPlayer(
    matchId: string,
    playerId: string
  ): Promise<{
    json: string;
    base64: string;
  }> {
    const qrData: QrCodeData = {
      matchId,
      playerId,
      timestamp: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(qrData);

    try {
      // Generate QR code as base64 image
      const qrCodeBase64 = await QRCode.toDataURL(jsonString, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      return {
        json: jsonString,
        base64: qrCodeBase64,
      };
    } catch (error) {
      console.error("Error generating QR code:", error);
      // Fallback to text-based QR (for development)
      return {
        json: jsonString,
        base64: `data:image/png;base64,${Buffer.from(jsonString).toString(
          "base64"
        )}`,
      };
    }
  }

  /**
   * Get all QR codes for a match (for reprinting)
   */
  async getAllQrCodes(matchId: string): Promise<
    Array<{
      playerId: string;
      playerName: string;
      qrCode: string;
      qrCodeBase64: string;
    }>
  > {
    const match = this.matches.get(matchId);
    if (!match) {
      return [];
    }

    const qrCodes = [];
    for (const player of match.players.values()) {
      qrCodes.push({
        playerId: player.id,
        playerName: player.name,
        qrCode: player.qrCode,
        qrCodeBase64: player.qrCodeBase64,
      });
    }

    return qrCodes;
  }

  /**
   * Check if player is admin of match
   */
  isPlayerAdmin(matchId: string, playerId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }
    return match.adminId === playerId;
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
