// Match and Player Type Definitions

export type MatchState = "waiting" | "active" | "paused" | "ended";
export type PlayerState = "connected" | "disconnected" | "eliminated";
export type PlayerRole = "player" | "admin";

// Score and Inventory Types
export type ScoreType =
  | "shot_hit"
  | "item_dropoff"
  | "bonus"
  | "penalty"
  | "achievement";
export type ItemType =
  | "plastic_bottle"
  | "can"
  | "paper"
  | "glass"
  | "organic"
  | "metal"
  | "cardboard"
  | "other";

export interface ScoreEntry {
  id: string;
  type: ScoreType;
  points: number;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>; // For additional data like item type, location, etc.
}

export interface InventoryItem {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  value: number; // Points when dropped off
  potentialScore: number; // Maximum possible score from this item
  pickedUpAt: Date;
  location?: {
    lat: number;
    lng: number;
  };
  metadata?: Record<string, any>;
}

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
  inventory: InventoryItem[]; // Player's collected items
  scoreHistory: ScoreEntry[]; // History of all score changes
}

export interface Match {
  id: string;
  state: MatchState;
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
  role: PlayerRole;
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

// Inventory Events
export interface ItemPickedUpPayload {
  matchId: string;
  playerId: string;
  item: InventoryItem;
  timestamp: string;
}

export interface ItemDroppedOffPayload {
  matchId: string;
  playerId: string;
  item: InventoryItem;
  pointsEarned: number;
  timestamp: string;
}

export interface ScoreUpdatePayload {
  matchId: string;
  playerId: string;
  scoreEntry: ScoreEntry;
  newTotalScore: number;
  timestamp: string;
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

/**
 * Garbage types - items found on the floor/ground (4 types)
 */
export enum GarbageType {
  FOOD_SCRAPS = "Food scraps", // 🍎 Organic waste
  MIXED_PAPER = "Mixed Paper", // 📄 Paper products
  RECYCLABLE = "Recyclable", // ♻️ Clean recyclables
  LANDFILL = "Landfill", // 🚮 Non-recyclable waste
}

/**
 * Bin types - waste containers identified by color/labels (5 types)
 */
export enum BinType {
  FOOD_SCRAPS_BIN = "Food scraps bin", // 🟢 Green
  MIXED_PAPER_BIN = "Mixed Paper bin", // 🟡 Yellow
  RECYCLABLE_BIN = "Recyclable bin", // 🔵 Blue
  LANDFILL_BIN = "Landfill bin", // ⚫ Grey
  UNKNOWN_BIN = "Unknown bin", // ⚪ Can't identify type
}

/**
 * Garbage item detected on floor/ground
 */
export interface Garbage {
  id?: string; // Autogenerated when adding to inventory
  itemName: string; // Specific name (e.g., "plastic water bottle")
  itemType: GarbageType; // One of the 4 garbage types
  co2Savings: number; // kg CO₂ saved if properly disposed
}

/**
 * Bin/container detected in image
 */
export interface Bin {
  itemName: string; // Specific name (e.g., "blue recycling bin")
  itemType: BinType; // One of the 5 bin types
}

/**
 * Detected item - can be either garbage or bin
 */
export type DetectedItem = Garbage | Bin;

/**
 * Detection result from garbage/bin detection
 */
export interface DetectionResult {
  detectedItems: DetectedItem[]; // Array of detected garbage and/or bins
  garbage: Garbage[]; // All garbage items
  bins: Bin[]; // All bin items
  totalCO2Savings: number; // Sum of all garbage CO₂ savings
  confidence: "high" | "medium" | "low";
  description: string;
}

// WebSocket Event Types
export type GameWebSocketEvent =
  | { type: "player:connect"; data: PlayerConnectPayload }
  | { type: "player:disconnect"; data: PlayerDisconnectPayload }
  | { type: "shot:attempt"; data: ShotAttemptPayload }
  | { type: "admin:action"; data: MatchAdminAction }
  | { type: "item:pickup"; data: ItemPickedUpPayload }
  | { type: "item:dropoff"; data: ItemDroppedOffPayload };

export type GameWebSocketBroadcast =
  | { type: "match:state"; data: MatchStatePayload }
  | { type: "player:joined"; data: PlayerJoinedPayload }
  | { type: "player:left"; data: PlayerLeftPayload }
  | { type: "leaderboard:update"; data: LeaderboardUpdatePayload }
  | { type: "shot:result"; data: ShotResultPayload }
  | { type: "match:started"; data: MatchStartedPayload }
  | { type: "match:paused"; data: MatchPausedPayload }
  | { type: "match:resumed"; data: MatchResumedPayload }
  | { type: "match:ended"; data: MatchEndedPayload }
  | { type: "item:picked_up"; data: ItemPickedUpPayload }
  | { type: "item:dropped_off"; data: ItemDroppedOffPayload }
  | { type: "score:update"; data: ScoreUpdatePayload };
