// Match and Player Type Definitions

export type MatchState = "waiting" | "active" | "paused" | "ended";
export type PlayerState = "connected" | "disconnected" | "eliminated";
export type PlayerRole = "player" | "admin";

export interface Player {
  id: string;
  name: string;
  qrCode: string;
  qrCodeBase64: string; // Base64 encoded QR code for frontend
  score: number;
  shots: number;
  state: PlayerState;
  role: PlayerRole;
  joinedAt: Date;
  isActive: boolean; // Whether player is currently active in the match
}

export interface Match {
  id: string;
  state: MatchState;
  players: Map<string, Player>;
  adminId: string; // ID of the match admin
  createdAt: Date;
  startedAt?: Date;
  pausedAt?: Date;
  endedAt?: Date;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  score: number;
  shots: number;
  rank: number;
  hits: number;
}

// Shot data structure for database storage
export interface Shot {
  id: string;
  matchId: string;
  playerId: string;
  targetPlayerId: string;
  timestamp: Date;
  imageUrl?: string;
  isHit: boolean;
  points: number;
  processedAt?: Date;
}

// WebSocket Event Payloads

export interface PlayerConnectPayload {
  matchId: string;
  playerId: string;
}

export interface PlayerDisconnectPayload {
  matchId: string;
  playerId: string;
}

// Shot attempt from frontend - simplified
export interface ShotAttemptPayload {
  matchId: string;
  shooterId: string;
  imageData: string; // base64 encoded image
}

// Match admin actions
export interface MatchAdminAction {
  matchId: string;
  adminId: string;
  action: "start" | "pause" | "resume" | "end";
}

// Player join request
export interface PlayerJoinRequest {
  matchId: string;
  playerName: string;
}

// Player join response
export interface PlayerJoinResponse {
  playerId: string;
  playerName: string;
  qrCode: string; // JSON string
  qrCodeBase64: string; // Base64 encoded QR image
  matchId: string;
  role: PlayerRole;
}

// QR code data structure
export interface QrCodeData {
  matchId: string;
  playerId: string;
  timestamp: string;
}

// Match admin events
export interface MatchPausedPayload {
  matchId: string;
  pausedAt: string;
  adminId: string;
}

export interface MatchResumedPayload {
  matchId: string;
  resumedAt: string;
  adminId: string;
}

export interface MatchStatePayload {
  matchId: string;
  state: MatchState;
  players: Array<{
    id: string;
    name: string;
    score: number;
    state: PlayerState;
  }>;
}

export interface PlayerJoinedPayload {
  matchId: string;
  player: {
    id: string;
    name: string;
    qrCode: string;
  };
}

export interface PlayerLeftPayload {
  matchId: string;
  playerId: string;
}

export interface LeaderboardUpdatePayload {
  matchId: string;
  leaderboard: LeaderboardEntry[];
}

// Shot result broadcast to all players
export interface ShotResultPayload {
  matchId: string;
  shotId: string;
  shooterId: string;
  targetId: string; // empty string if miss
  hit: boolean;
  timestamp: string;
}

export interface MatchStartedPayload {
  matchId: string;
  startedAt: string;
}

export interface MatchEndedPayload {
  matchId: string;
  endedAt: string;
  winner: {
    playerId: string;
    playerName: string;
    score: number;
  } | null;
}

// WebSocket Event Types
export type GameWebSocketEvent =
  | { type: "player:connect"; data: PlayerConnectPayload }
  | { type: "player:disconnect"; data: PlayerDisconnectPayload }
  | { type: "shot:attempt"; data: ShotAttemptPayload }
  | { type: "admin:action"; data: MatchAdminAction };

export type GameWebSocketBroadcast =
  | { type: "match:state"; data: MatchStatePayload }
  | { type: "player:joined"; data: PlayerJoinedPayload }
  | { type: "player:left"; data: PlayerLeftPayload }
  | { type: "leaderboard:update"; data: LeaderboardUpdatePayload }
  | { type: "shot:result"; data: ShotResultPayload }
  | { type: "match:started"; data: MatchStartedPayload }
  | { type: "match:paused"; data: MatchPausedPayload }
  | { type: "match:resumed"; data: MatchResumedPayload }
  | { type: "match:ended"; data: MatchEndedPayload };
