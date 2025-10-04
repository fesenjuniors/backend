// Match and Player Type Definitions

export type MatchState = "waiting" | "active" | "ended";
export type PlayerState = "connected" | "disconnected" | "eliminated";

export interface Player {
  id: string;
  name: string;
  qrCode: string;
  score: number;
  shots: number;
  state: PlayerState;
  joinedAt: Date;
}

export interface Match {
  id: string;
  state: MatchState;
  players: Map<string, Player>;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  score: number;
  shots: number;
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
  | { type: "shot:attempt"; data: ShotAttemptPayload }; // TO BE IMPLEMENTED

export type GameWebSocketBroadcast =
  | { type: "match:state"; data: MatchStatePayload }
  | { type: "player:joined"; data: PlayerJoinedPayload }
  | { type: "player:left"; data: PlayerLeftPayload }
  | { type: "leaderboard:update"; data: LeaderboardUpdatePayload }
  | { type: "shot:result"; data: ShotResultPayload } // TO BE IMPLEMENTED
  | { type: "match:started"; data: MatchStartedPayload }
  | { type: "match:ended"; data: MatchEndedPayload };
