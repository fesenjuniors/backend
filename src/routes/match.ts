import type { Request, Response } from "express";
import { Router } from "express";
import { matchManager } from "../services/matchManager";
import { websocketManager } from "../server/server";
import type {
  MatchStartedPayload,
  MatchEndedPayload,
  MatchStatePayload,
} from "../types/game";

const router = Router();

/**
 * Create a new match
 * POST /api/match/create
 */
router.post("/api/match/create", (_req: Request, res: Response) => {
  try {
    const match = matchManager.createMatch();

    res.status(201).json({
      matchId: match.id,
      createdAt: match.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Error creating match:", error);
    res.status(500).json({ error: "Failed to create match" });
  }
});

/**
 * Get match details
 * GET /api/match/:matchId
 */
router.get("/api/match/:matchId", (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;

  const match = matchManager.getMatch(matchId);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const players = Array.from(match.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    score: player.score,
    shots: player.shots,
    state: player.state,
    joinedAt: player.joinedAt.toISOString(),
  }));

  res.status(200).json({
    id: match.id,
    state: match.state,
    players,
    createdAt: match.createdAt.toISOString(),
    startedAt: match.startedAt?.toISOString(),
    endedAt: match.endedAt?.toISOString(),
  });
});

/**
 * Start a match
 * POST /api/match/:matchId/start
 */
router.post("/api/match/:matchId/start", (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;

  const match = matchManager.getMatch(matchId);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const success = matchManager.startMatch(matchId);
  if (!success) {
    res.status(400).json({
      error: "Failed to start match. Check match state and player count.",
    });
    return;
  }

  // Broadcast match started event
  const payload: MatchStartedPayload = {
    matchId,
    startedAt: match.startedAt!.toISOString(),
  };

  websocketManager.broadcast(
    JSON.stringify({
      type: "match:started",
      data: payload,
    })
  );

  res.status(200).json({
    matchId,
    state: match.state,
    startedAt: match.startedAt?.toISOString(),
  });
});

/**
 * End a match
 * POST /api/match/:matchId/end
 */
router.post("/api/match/:matchId/end", (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;

  const match = matchManager.getMatch(matchId);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const success = matchManager.endMatch(matchId);
  if (!success) {
    res
      .status(400)
      .json({ error: "Failed to end match. Match must be active." });
    return;
  }

  const winner = matchManager.getWinner(matchId);

  // Broadcast match ended event
  const payload: MatchEndedPayload = {
    matchId,
    endedAt: match.endedAt!.toISOString(),
    winner: winner || null,
  };

  websocketManager.broadcast(
    JSON.stringify({
      type: "match:ended",
      data: payload,
    })
  );

  res.status(200).json({
    matchId,
    state: match.state,
    endedAt: match.endedAt?.toISOString(),
    winner,
  });
});

/**
 * Get match leaderboard
 * GET /api/match/:matchId/leaderboard
 */
router.get("/api/match/:matchId/leaderboard", (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;

  const match = matchManager.getMatch(matchId);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const leaderboard = matchManager.getLeaderboard(matchId);

  res.status(200).json({
    matchId,
    leaderboard,
  });
});

/**
 * Join a match
 * POST /api/match/:matchId/join
 */
router.post("/api/match/:matchId/join", (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;
  const { playerName, playerId } = req.body;

  if (!playerName || typeof playerName !== "string") {
    res.status(400).json({ error: "playerName is required" });
    return;
  }

  const match = matchManager.getMatch(matchId);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const player = matchManager.addPlayer(matchId, playerName, playerId);
  if (!player) {
    res
      .status(400)
      .json({ error: "Failed to join match. Match may have already started." });
    return;
  }

  res.status(201).json({
    playerId: player.id,
    playerName: player.name,
    qrCode: player.qrCode,
    matchId,
  });
});

export default router;
