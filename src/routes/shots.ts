import type { Request, Response } from "express";
import { Router } from "express";
import { getShotLogs, getPlayerShotStats } from "../services/shotHandler";

const router = Router();

/**
 * Get all shot logs for a match
 * GET /api/match/:matchId/shots
 */
router.get("/api/match/:matchId/shots", (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;

  try {
    const shotLogs = getShotLogs(matchId);

    res.status(200).json({
      matchId,
      totalShots: shotLogs.length,
      shots: shotLogs.map((log) => ({
        shotId: log.shotId,
        shooterId: log.shooterId,
        targetId: log.targetId,
        hit: log.hit,
        // confidence: log.confidence, // Removed - not in ShotLog type
        timestamp: log.timestamp.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching shot logs:", error);
    res.status(500).json({ error: "Failed to fetch shot logs" });
  }
});

/**
 * Get shot statistics for a specific player
 * GET /api/match/:matchId/player/:playerId/stats
 */
router.get(
  "/api/match/:matchId/player/:playerId/stats",
  (req: Request, res: Response) => {
    const matchId = req.params.matchId as string;
    const playerId = req.params.playerId as string;

    try {
      const stats = getPlayerShotStats(matchId, playerId);

      res.status(200).json({
        matchId,
        playerId,
        ...stats,
      });
    } catch (error) {
      console.error("Error fetching player stats:", error);
      res.status(500).json({ error: "Failed to fetch player stats" });
    }
  }
);

export default router;
