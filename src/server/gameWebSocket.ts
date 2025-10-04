import type { WebSocket } from "ws";
import type { WebSocketManager } from "./websocket";
import { matchManager } from "../services/matchManager";
import { handleShotResult } from "../services/shotHandler";
import { processShotImage } from "../services/shotProcessor";
import type {
  GameWebSocketEvent,
  PlayerConnectPayload,
  PlayerDisconnectPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  MatchStatePayload,
  LeaderboardUpdatePayload,
  ShotAttemptPayload,
} from "../types/game";

/**
 * Setup game-specific WebSocket event handlers
 */
export const setupGameWebSocketHandlers = (
  wsManager: WebSocketManager
): void => {
  wsManager.on("message", (clientId, data, ws) => {
    try {
      const message: GameWebSocketEvent = JSON.parse(data);

      switch (message.type) {
        case "player:connect":
          handlePlayerConnect(message.data, ws, wsManager);
          break;

        case "player:disconnect":
          handlePlayerDisconnect(message.data, wsManager);
          break;

        case "shot:attempt":
          // Handle shot attempt
          // Simplified flow: process image → get targetId → save & broadcast
          handleShotAttempt(message.data, ws, wsManager).catch((error) => {
            console.error("Error in shot attempt handler:", error);
            ws.send(
              JSON.stringify({
                type: "error",
                data: {
                  message:
                    error instanceof Error
                      ? error.message
                      : "Shot processing failed",
                },
              })
            );
          });
          break;

        default:
          console.warn(
            `Unknown WebSocket event type: ${(message as any).type}`
          );
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
      ws.send(
        JSON.stringify({
          type: "error",
          data: {
            message: "Invalid message format",
          },
        })
      );
    }
  });
};

/**
 * Handle player:connect event
 */
function handlePlayerConnect(
  payload: PlayerConnectPayload,
  ws: WebSocket,
  wsManager: WebSocketManager
): void {
  const { matchId, playerId } = payload;

  console.log(`Player ${playerId} connecting to match ${matchId}`);

  // Verify match and player exist
  const match = matchManager.getMatch(matchId);
  if (!match) {
    ws.send(
      JSON.stringify({
        type: "error",
        data: { message: "Match not found" },
      })
    );
    return;
  }

  const player = matchManager.getPlayer(matchId, playerId);
  if (!player) {
    ws.send(
      JSON.stringify({
        type: "error",
        data: { message: "Player not found in match" },
      })
    );
    return;
  }

  // Update player state to connected
  matchManager.updatePlayerState(matchId, playerId, "connected");

  // Send current match state to the connecting player
  const matchStatePayload: MatchStatePayload = {
    matchId,
    state: match.state,
    players: Array.from(match.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      state: p.state,
    })),
  };

  ws.send(
    JSON.stringify({
      type: "match:state",
      data: matchStatePayload,
    })
  );

  // Broadcast to all clients that player joined
  const playerJoinedPayload: PlayerJoinedPayload = {
    matchId,
    player: {
      id: player.id,
      name: player.name,
      qrCode: player.qrCode,
    },
  };

  wsManager.broadcast(
    JSON.stringify({
      type: "player:joined",
      data: playerJoinedPayload,
    })
  );

  console.log(`Player ${playerId} connected to match ${matchId}`);
}

/**
 * Handle player:disconnect event
 */
function handlePlayerDisconnect(
  payload: PlayerDisconnectPayload,
  wsManager: WebSocketManager
): void {
  const { matchId, playerId } = payload;

  console.log(`Player ${playerId} disconnecting from match ${matchId}`);

  // Update player state to disconnected
  const success = matchManager.updatePlayerState(
    matchId,
    playerId,
    "disconnected"
  );

  if (success) {
    // Broadcast to all clients that player left
    const playerLeftPayload: PlayerLeftPayload = {
      matchId,
      playerId,
    };

    wsManager.broadcast(
      JSON.stringify({
        type: "player:left",
        data: playerLeftPayload,
      })
    );

    console.log(`Player ${playerId} disconnected from match ${matchId}`);
  }
}

/**
 * Handle shot attempt
 * Flow: frontend sends image → we process → save & broadcast
 */
async function handleShotAttempt(
  payload: ShotAttemptPayload,
  ws: WebSocket,
  wsManager: WebSocketManager
): Promise<void> {
  const { matchId, shooterId, imageData } = payload;

  try {
    console.log(`Shot attempt received from shooter ${shooterId}`);

    // 1. Call shot processor (implemented by another hackathonee)
    // This returns targetId or null
    const result = await processShotImage({
      shooterId,
      matchId,
      imageBase64: imageData,
    });

    // 2. Handle the result (save to DB and broadcast)
    await handleShotResult(matchId, shooterId, result.targetId, wsManager);
  } catch (error) {
    // If shot processor is not implemented yet, send helpful error
    if (
      error instanceof Error &&
      error.message.includes("not yet implemented")
    ) {
      ws.send(
        JSON.stringify({
          type: "error",
          data: {
            message:
              "Shot processing not yet implemented. Waiting for another hackathonee to complete shotProcessor.ts",
          },
        })
      );
    } else {
      throw error;
    }
  }
}

/**
 * Broadcast leaderboard update to all clients
 * This function should be called after score changes
 */
export function broadcastLeaderboardUpdate(
  matchId: string,
  wsManager: WebSocketManager
): void {
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
