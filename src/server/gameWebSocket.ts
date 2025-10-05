import type { WebSocket } from "ws";
import type { WebSocketManager } from "./websocket";
import { matchManager } from "../services/matchManager";
import { handleShotResult } from "../services/shotHandler";
import {
  processShotImage,
  decodeAndScanQrWithDebug,
} from "../services/shotProcessor";
import { broadcastResult } from "../services/shotHandler";
import type {
  GameWebSocketEvent,
  PlayerConnectPayload,
  PlayerDisconnectPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  MatchStatePayload,
  LeaderboardUpdatePayload,
  ShotAttemptPayload,
  MatchAdminAction,
} from "../types/game";
import { scanQRFromBase64 } from "../utils/qr-base64-scanner";

/**
 * Setup game-specific WebSocket event handlers
 */
export const setupGameWebSocketHandlers = (
  wsManager: WebSocketManager
): void => {
  wsManager.on("message", (clientId, data, ws) => {
    try {
      // Validate WebSocket connection is still open
      if (ws.readyState !== ws.OPEN) {
        console.warn(`WebSocket connection closed for client ${clientId}`);
        return;
      }

      // Validate message data
      if (!data || typeof data !== "string") {
        console.warn(`Invalid message data from client ${clientId}:`, data);
        sendError(ws, "Invalid message format");
        return;
      }

      // Parse message with error handling
      let message: GameWebSocketEvent;
      try {
        message = JSON.parse(data);
      } catch (parseError) {
        console.warn(`JSON parse error from client ${clientId}:`, parseError);
        sendError(ws, "Invalid JSON format");
        return;
      }

      // Validate message structure
      if (!message || typeof message !== "object" || !message.type) {
        console.warn(
          `Invalid message structure from client ${clientId}:`,
          message
        );
        sendError(ws, "Invalid message structure");
        return;
      }

      // Route message to appropriate handler
      switch (message.type) {
        case "player:connect":
          handlePlayerConnect(message.data, ws, wsManager);
          break;

        case "player:disconnect":
          handlePlayerDisconnect(message.data, wsManager);
          break;

        case "shot:attempt":
          // Handle shot attempt with proper error handling
          handleShotAttempt(message.data, ws, wsManager).catch((error) => {
            console.error("Error in shot attempt handler:", error);
            sendError(ws, "Shot processing failed");
          });
          break;

        case "admin:action":
          // Handle admin actions (start, pause, resume, end match)
          handleAdminAction(message.data, ws, wsManager).catch((error) => {
            console.error("Error in admin action handler:", error);
            sendError(ws, "Admin action failed");
          });
          break;

        default:
          console.warn(
            `Unknown WebSocket event type: ${
              (message as any).type
            } from client ${clientId}`
          );
          sendError(ws, `Unknown event type: ${(message as any).type}`);
      }
    } catch (error) {
      console.error("Unexpected error in WebSocket handler:", error);
      sendError(ws, "Internal server error");
    }
  });
};

/**
 * Send error message to WebSocket client
 */
function sendError(ws: WebSocket, message: string): void {
  try {
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({
          type: "error",
          data: { message },
          timestamp: new Date().toISOString(),
        })
      );
    }
  } catch (error) {
    console.error("Error sending error message to WebSocket:", error);
  }
}

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

  // Verify match exists (try to load from database if not in memory)
  let match = matchManager.getMatch(matchId);
  if (!match) {
    // Try to load match from database
    matchManager
      .loadMatchFromDatabase(matchId)
      .then((loadedMatch) => {
        if (!loadedMatch) {
          ws.send(
            JSON.stringify({
              type: "error",
              data: { message: "Match not found" },
            })
          );
          return;
        }

        // Retry connection with loaded match
        handlePlayerConnect(payload, ws, wsManager);
      })
      .catch((error) => {
        console.error("Error loading match from database:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            data: { message: "Failed to load match" },
          })
        );
      });
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

  // Send player's current data (inventory, scores, etc.)
  ws.send(
    JSON.stringify({
      type: "player:data",
      data: {
        matchId,
        playerId,
        inventory: player.inventory,
        scoreHistory: player.scoreHistory,
        score: player.score,
      },
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

    // 1. Call scanQRFromBase64 to get QR code content
    const qrContent = await scanQRFromBase64(imageData);

    let targetId: string | null = null;

    // 2. Parse the QR content if found
    if (qrContent) {
      try {
        // Parse the JSON to extract playerId
        const qrData = JSON.parse(qrContent);
        console.log(`📄 Parsed QR data:`, qrData);

        // Extract the playerId from the QR data
        if (qrData && qrData.playerId) {
          targetId = qrData.playerId;
          console.log(`✅ QR parsed successfully. Target player: ${targetId}`);

          // Optional: Verify the matchId matches
          if (qrData.matchId && qrData.matchId !== matchId) {
            console.warn(
              `⚠️ QR code is from different match: ${qrData.matchId} vs ${matchId}`
            );
            // You might want to treat this as a miss
            // targetId = null;
          }
        } else {
          console.log(
            `❌ QR content doesn't contain playerId. QR data:`,
            qrData
          );
        }
      } catch (parseError) {
        console.log(`❌ Failed to parse QR content as JSON: ${qrContent}`);
        // If it's not JSON, maybe it's just the player ID directly
        // This maintains backward compatibility if needed
        targetId = qrContent;
      }
    } else {
      console.log(`❌ No QR code detected - MISS`);
    }

    console.log(`Shot processed. Target ID: ${targetId || "MISS"}`);

    // 3. Pass to broadcastResult
    await broadcastResult(matchId, shooterId, targetId, wsManager);
  } catch (error) {
    // If processing fails, send helpful error
    console.error("Error in shot attempt handler:", error);
    ws.send(
      JSON.stringify({
        type: "error",
        data: {
          message:
            error instanceof Error ? error.message : "Shot processing failed",
        },
      })
    );
  }
}

/**
 * Handle admin action (start, pause, resume, end match)
 */
async function handleAdminAction(
  payload: MatchAdminAction,
  ws: WebSocket,
  wsManager: WebSocketManager
): Promise<void> {
  const { matchId, adminId, action } = payload;

  console.log(
    `Admin action: ${action} for match ${matchId} by admin ${adminId}`
  );

  // Verify match exists
  const match = matchManager.getMatch(matchId);
  if (!match) {
    sendError(ws, "Match not found");
    return;
  }

  // Verify admin permissions
  if (match.adminId !== adminId) {
    sendError(ws, "Unauthorized: Only match admin can perform this action");
    return;
  }

  let success = false;
  let broadcastEvent: string | null = null;
  let broadcastData: any = null;

  switch (action) {
    case "start":
      success = matchManager.startMatch(matchId, adminId);
      if (success) {
        broadcastEvent = "match:started";
        broadcastData = {
          matchId,
          startedAt: match.startedAt!.toISOString(),
        };
      }
      break;

    case "pause":
      success = matchManager.pauseMatch(matchId, adminId);
      if (success) {
        broadcastEvent = "match:paused";
        broadcastData = {
          matchId,
          pausedAt: match.pausedAt!.toISOString(),
          adminId,
        };
      }
      break;

    case "resume":
      success = matchManager.resumeMatch(matchId, adminId);
      if (success) {
        broadcastEvent = "match:resumed";
        broadcastData = {
          matchId,
          resumedAt: new Date().toISOString(),
          adminId,
        };
      }
      break;

    case "end":
      success = matchManager.endMatch(matchId, adminId);
      if (success) {
        const winner = matchManager.getWinner(matchId);
        broadcastEvent = "match:ended";
        broadcastData = {
          matchId,
          endedAt: match.endedAt!.toISOString(),
          winner: winner || null,
        };
      }
      break;

    default:
      sendError(ws, `Unknown admin action: ${action}`);
      return;
  }

  if (!success) {
    sendError(
      ws,
      `Failed to ${action} match. Check match state and permissions.`
    );
    return;
  }

  // Broadcast the event to all clients
  if (broadcastEvent && broadcastData) {
    wsManager.broadcast(
      JSON.stringify({
        type: broadcastEvent,
        data: broadcastData,
      })
    );
  }

  // Send success response to admin
  ws.send(
    JSON.stringify({
      type: "admin:action:success",
      data: {
        matchId,
        action,
        timestamp: new Date().toISOString(),
      },
    })
  );

  console.log(`Admin action ${action} completed for match ${matchId}`);
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
