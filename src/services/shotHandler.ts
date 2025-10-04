/**
 * Shot Handler Service
 *
 * Simplified flow:
 * 1. Receives (shooterId, targetId or null) from shot processor
 * 2. Saves shot log to database
 * 3. Updates player scores if hit
 * 4. Broadcasts results to all connected players
 */

import { randomBytes } from "crypto";
import { matchManager } from "./matchManager";
import { shotRepository, type ShotLog } from "../repositories/shotRepository";
import type { WebSocketManager } from "../server/websocket";
import type {
  ShotResultPayload,
  LeaderboardUpdatePayload,
} from "../types/game";

/**
 * In-memory shot logs cache (for quick access before Firebase sync)
 */
const shotLogsCache = new Map<string, ShotLog[]>();

/**
 * Handle a processed shot result
 *
 * This is called AFTER the other hackathonee's image processing
 * Input: shooterId (never null), targetId (null if miss)
 */
export async function handleShotResult(
  matchId: string,
  shooterId: string,
  targetId: string | null,
  wsManager: WebSocketManager
): Promise<void> {
  console.log(
    `Processing shot result: Shooter ${shooterId}, Target ${
      targetId || "MISS"
    }, Match ${matchId}`
  );

  try {
    // 1. Validate match exists and is active
    const match = matchManager.getMatch(matchId);
    if (!match) {
      throw new Error("Match not found");
    }

    if (match.state !== "active") {
      throw new Error("Match is not active");
    }

    // 2. Validate shooter exists
    const shooter = matchManager.getPlayer(matchId, shooterId);
    if (!shooter) {
      throw new Error("Shooter not found in match");
    }

    // 3. Determine if it's a hit
    const hit = targetId !== null;

    // 4. If hit, validate target exists
    if (hit) {
      const target = matchManager.getPlayer(matchId, targetId);
      if (!target) {
        console.warn(`Target ${targetId} not found in match, treating as miss`);
        // Treat as miss if target doesn't exist
        return handleShotResult(matchId, shooterId, null, wsManager);
      }
    }

    // 5. Create shot log
    const shotLog: ShotLog = {
      shotId: generateShotId(),
      matchId,
      shooterId,
      targetId,
      hit,
      timestamp: new Date(),
    };

    // 6. Save to cache
    if (!shotLogsCache.has(matchId)) {
      shotLogsCache.set(matchId, []);
    }
    shotLogsCache.get(matchId)!.push(shotLog);

    // 7. Save shot log to database (async, non-blocking)
    shotRepository.saveShotLog(shotLog).catch((err) => {
      console.error("Failed to save shot log to Firebase:", err);
    });

    // 8. If hit, update shooter's score
    if (hit) {
      const scoreUpdated = matchManager.updatePlayerScore(
        matchId,
        shooterId,
        10
      );

      if (scoreUpdated) {
        console.log(`Score updated: Shooter ${shooterId} +10 points`);

        // 9. Broadcast leaderboard update
        await broadcastLeaderboardUpdate(matchId, wsManager);
      }
    }

    // 10. Broadcast shot result to all players
    const shotResultPayload: ShotResultPayload = {
      matchId,
      shotId: shotLog.shotId,
      shooterId,
      targetId: targetId || "",
      hit,
      timestamp: shotLog.timestamp.toISOString(),
    };

    wsManager.broadcast(
      JSON.stringify({
        type: "shot:result",
        data: shotResultPayload,
      })
    );

    console.log(
      `Shot processed: ${
        shotLog.shotId
      }, Hit: ${hit}, Shooter: ${shooterId}, Target: ${targetId || "NONE"}`
    );
  } catch (error) {
    console.error("Error handling shot result:", error);

    // Broadcast error to all players
    wsManager.broadcast(
      JSON.stringify({
        type: "shot:error",
        data: {
          matchId,
          shooterId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      })
    );
  }
}

/**
 * Get all shot logs for a match (from cache and/or Firebase)
 */
export function getShotLogs(matchId: string): ShotLog[] {
  return shotLogsCache.get(matchId) || [];
}

/**
 * Get shot statistics for a player
 */
export function getPlayerShotStats(
  matchId: string,
  playerId: string
): {
  totalShots: number;
  hits: number;
  misses: number;
  accuracy: number;
} {
  const logs = getShotLogs(matchId);
  const playerShots = logs.filter((log) => log.shooterId === playerId);

  const totalShots = playerShots.length;
  const hits = playerShots.filter((log) => log.hit).length;
  const misses = totalShots - hits;
  const accuracy = totalShots > 0 ? hits / totalShots : 0;

  return {
    totalShots,
    hits,
    misses,
    accuracy,
  };
}

/**
 * Broadcast leaderboard update to all clients
 */
async function broadcastLeaderboardUpdate(
  matchId: string,
  wsManager: WebSocketManager
): Promise<void> {
  const leaderboard = matchManager.getLeaderboard(matchId);

  const payload: LeaderboardUpdatePayload = {
    matchId,
    leaderboard,
  };

  wsManager.broadcast(
    JSON.stringify({
      type: "leaderboard:update",
      data: payload,
    })
  );

  console.log(`Leaderboard updated for match ${matchId}`);
}

/**
 * Generate unique shot ID
 */
function generateShotId(): string {
  return `shot_${randomBytes(8).toString("hex")}`;
}
