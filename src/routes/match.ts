import type { Request, Response } from "express";
import { Router } from "express";
import { matchManager } from "../services/matchManager";
import { websocketManager } from "../server/server";
import {
  asyncHandler,
  validateString,
  safeJsonResponse,
} from "../middleware/errorHandler";
import type {
  MatchStartedPayload,
  MatchEndedPayload,
  Player,
} from "../types/game";

const router = Router();

/**
 * Create a new match with admin
 * POST /api/match/create
 */
router.post("/api/match/create", (req: Request, res: Response) => {
  try {
    // Validate request body exists
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        error: "Invalid request body",
        details: "Request body must be a valid JSON object",
      });
    }

    const { adminName } = req.body;

    // Validate adminName
    if (!adminName) {
      return res.status(400).json({
        error: "adminName is required",
        details: "Please provide an admin name",
      });
    }

    if (typeof adminName !== "string") {
      return res.status(400).json({
        error: "adminName must be a string",
        details: "Admin name must be a text value",
      });
    }

    if (adminName.trim().length === 0) {
      return res.status(400).json({
        error: "adminName cannot be empty",
        details: "Please provide a valid admin name",
      });
    }

    if (adminName.length > 50) {
      return res.status(400).json({
        error: "adminName too long",
        details: "Admin name must be 50 characters or less",
      });
    }

    const match = matchManager.createMatch(adminName.trim());

    res.status(201).json({
      matchId: match.id,
      adminId: match.adminId,
      adminName: match.players.get(match.adminId)?.name || adminName.trim(),
      createdAt: match.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Error creating match:", error);

    // Don't expose internal errors to client
    res.status(500).json({
      error: "Failed to create match",
      details: "An internal server error occurred. Please try again.",
    });
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
    role: player.role,
    joinedAt: player.joinedAt.toISOString(),
  }));

  res.status(200).json({
    id: match.id,
    state: match.state,
    adminId: match.adminId,
    players,
    totalPlayers: players.length,
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

  const { adminId } = req.body;

  if (!adminId) {
    res.status(400).json({ error: "adminId is required" });
    return;
  }

  const success = matchManager.startMatch(matchId, adminId);
  if (!success) {
    res.status(400).json({
      error:
        "Failed to start match. Check admin permissions, match state and player count.",
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

  const { adminId } = req.body;

  if (!adminId) {
    res.status(400).json({ error: "adminId is required" });
    return;
  }

  const success = matchManager.endMatch(matchId, adminId);
  if (!success) {
    res.status(400).json({
      error: "Failed to end match. Check admin permissions and match state.",
    });
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
    totalPlayers: leaderboard.length,
    adminId: match.adminId,
  });
});

/**
 * Join a match
 * POST /api/match/:matchId/join
 */
router.post(
  "/api/match/:matchId/join",
  asyncHandler(async (req: Request, res: Response) => {
    const matchId = req.params.matchId as string;
    const { playerName, playerId } = req.body;

    // Validate matchId
    if (!matchId || typeof matchId !== "string") {
      return safeJsonResponse(res, 400, {
        error: "Invalid match ID",
        details: "Match ID is required and must be a string",
      });
    }

    // Validate playerName
    const validation = validateString(playerName, "playerName", {
      required: true,
      maxLength: 50,
      minLength: 1,
    });

    if (!validation.isValid) {
      return safeJsonResponse(res, 400, {
        error: validation.error,
        details: "Please provide a valid player name",
      });
    }

    // First, try to load match from database if not in memory
    let match = matchManager.getMatch(matchId);
    console.log(`Match ${matchId} in memory: ${!!match}`);
    if (!match) {
      console.log(`Loading match ${matchId} from database...`);
      const loadedMatch = await matchManager.loadMatchFromDatabase(matchId);
      if (!loadedMatch) {
        console.log(`Match ${matchId} not found in database`);
        return safeJsonResponse(res, 404, {
          error: "Match not found",
          details: `No match found with ID: ${matchId}`,
        });
      }
      match = loadedMatch;
      console.log(`Match ${matchId} loaded from database`);
    }

    // Check if player already exists (for rejoin)
    const existingPlayer = Array.from(match.players.values()).find(
      (p) => p.name.toLowerCase() === playerName.trim().toLowerCase()
    );

    console.log(
      `Looking for existing player "${playerName}" in match ${matchId}`
    );
    console.log(`Match has ${match.players.size} players`);
    console.log(
      `Player names: ${Array.from(match.players.values())
        .map((p) => p.name)
        .join(", ")}`
    );

    let player: Player | null = null;
    let isRejoin = false;

    if (existingPlayer) {
      // Player exists - this is a rejoin
      console.log(`Player "${playerName}" rejoining match ${matchId}`);
      console.log(
        `Existing player found: ${existingPlayer.id}, score: ${existingPlayer.score}, shots: ${existingPlayer.shots}`
      );
      player = await matchManager.rejoinPlayer(matchId, playerName.trim());
      isRejoin = true;

      if (!player) {
        return safeJsonResponse(res, 500, {
          error: "Failed to rejoin match",
          details: "Could not rejoin existing player",
        });
      }
    } else {
      // Player doesn't exist - create new player
      console.log(`New player "${playerName}" joining match ${matchId}`);
      player = await matchManager.addPlayer(
        matchId,
        playerName.trim(),
        playerId
      );

      if (!player) {
        return safeJsonResponse(res, 400, {
          error: "Failed to join match",
          details: "Match may have already started or is full",
        });
      }
    }

    // Unified response for both new players and rejoining players
    safeJsonResponse(res, isRejoin ? 200 : 201, {
      success: true,
      message: isRejoin
        ? "Successfully rejoined match"
        : "Successfully joined match",
      player: {
        id: player.id,
        name: player.name,
        qrCode: player.qrCode,
        qrCodeBase64: player.qrCodeBase64,
        matchId: matchId,
        role: player.role,
        score: player.score,
        shots: player.shots,
        inventory: player.inventory,
        scoreHistory: player.scoreHistory,
      },
    });
  })
);

/**
 * Pause a match (admin only)
 * POST /api/match/:matchId/pause
 */
router.post("/api/match/:matchId/pause", (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;
  const { adminId } = req.body;

  if (!adminId) {
    res.status(400).json({ error: "adminId is required" });
    return;
  }

  const match = matchManager.getMatch(matchId);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const success = matchManager.pauseMatch(matchId, adminId);
  if (!success) {
    res.status(400).json({
      error: "Failed to pause match. Check admin permissions and match state.",
    });
    return;
  }

  // Broadcast match paused event
  const payload = {
    matchId,
    pausedAt: match.pausedAt!.toISOString(),
    adminId,
  };

  websocketManager.broadcast(
    JSON.stringify({
      type: "match:paused",
      data: payload,
    })
  );

  res.status(200).json({
    matchId,
    state: match.state,
    pausedAt: match.pausedAt?.toISOString(),
  });
});

/**
 * Resume a match (admin only)
 * POST /api/match/:matchId/resume
 */
router.post("/api/match/:matchId/resume", (req: Request, res: Response) => {
  const matchId = req.params.matchId as string;
  const { adminId } = req.body;

  if (!adminId) {
    res.status(400).json({ error: "adminId is required" });
    return;
  }

  const match = matchManager.getMatch(matchId);
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const success = matchManager.resumeMatch(matchId, adminId);
  if (!success) {
    res.status(400).json({
      error: "Failed to resume match. Check admin permissions and match state.",
    });
    return;
  }

  // Broadcast match resumed event
  const payload = {
    matchId,
    resumedAt: new Date().toISOString(),
    adminId,
  };

  websocketManager.broadcast(
    JSON.stringify({
      type: "match:resumed",
      data: payload,
    })
  );

  res.status(200).json({
    matchId,
    state: match.state,
  });
});

/**
 * Get all players for a match with detailed information
 * GET /api/match/:matchId/players
 */
router.get(
  "/api/match/:matchId/players",
  async (req: Request, res: Response) => {
    const matchId = req.params.matchId as string;

    try {
      const match = matchManager.getMatch(matchId);
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }

      const players = Array.from(match.players.values()).map((player) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        shots: player.shots,
        state: player.state,
        role: player.role,
        isActive: player.isActive,
        joinedAt: player.joinedAt.toISOString(),
        inventory: player.inventory,
        scoreHistory: player.scoreHistory,
      }));

      res.status(200).json({
        matchId,
        players,
        totalPlayers: players.length,
        adminId: match.adminId,
      });
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({ error: "Failed to fetch players" });
    }
  }
);

export default router;
