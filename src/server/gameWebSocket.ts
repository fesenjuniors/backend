import type { WebSocket } from "ws";
import type { WebSocketManager } from "./websocket";
import { matchManager } from "../services/matchManager";
import { handleShotResult } from "../services/shotHandler";
import {
  processShotImage,
  decodeAndScanQrWithDebug,
} from "../services/shotProcessor";
import { broadcastResult } from "../services/shotHandler";
import {
  GameWebSocketEvent,
  PlayerConnectPayload,
  PlayerDisconnectPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  MatchStatePayload,
  LeaderboardUpdatePayload,
  ShotAttemptPayload,
  MatchAdminAction,
  GarbageType,
  BinType,
  Bin,
  Garbage,
} from "../types/game";
import { scanQRFromBase64 } from "../utils/qr-base64-scanner";
import { detectGarbageInImage } from "../utils/garbage-detector";
import { inventoryRepository } from "../repositories/inventoryRepository";

/**
 * Setup game-specific WebSocket event handlers
 */
export const setupGameWebSocketHandlers = (
  wsManager: WebSocketManager
): void => {
  wsManager.on("message", async (clientId, data, ws) => {
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
          await handlePlayerConnect(message.data, ws, wsManager);
          break;

        case "player:disconnect":
          await handlePlayerDisconnect(message.data, wsManager);
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
async function handlePlayerConnect(
  payload: PlayerConnectPayload,
  ws: WebSocket,
  wsManager: WebSocketManager
): Promise<void> {
  const { matchId, playerId } = payload;

  console.log(`Player ${playerId} connecting to match ${matchId}`);

  // Verify match exists (try to load from database if not in memory)
  let match = matchManager.getMatch(matchId);
  if (!match) {
    // Try to load match from database
    matchManager
      .loadMatchFromDatabase(matchId)
      .then(async (loadedMatch) => {
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
        await handlePlayerConnect(payload, ws, wsManager);
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

  const player = await matchManager.getPlayer(matchId, playerId);
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
  await matchManager.updatePlayerState(matchId, playerId, "connected");

  // Send current match state to the connecting player
  const matchStatePayload: MatchStatePayload = {
    matchId,
    state: match.state,
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
async function handlePlayerDisconnect(
  payload: PlayerDisconnectPayload,
  wsManager: WebSocketManager
): Promise<void> {
  const { matchId, playerId } = payload;

  console.log(`Player ${playerId} disconnecting from match ${matchId}`);

  // Update player state to disconnected
  const success = await matchManager.updatePlayerState(
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
        console.log(
          `❌ Failed to parse QR content as JSON: ${qrContent}`,
          parseError
        );
        // Don't set targetId here - let it fall through to garbage detection
        // Only set targetId if we have a valid player ID format
        if (
          qrContent &&
          qrContent.length > 10 &&
          qrContent.startsWith("player_")
        ) {
          targetId = qrContent;
        }
      }
    }
    // If no QR code found or parsing failed, do garbage detection
    if (!targetId) {
      console.log("hello");
      const result = await detectGarbageInImage(imageData);
      const bins: Bin[] = result.bins;
      const Current_garbage: Garbage[] = result.garbage;

      if (Current_garbage.length > 0) {
        console.log(
          `Detected ${Current_garbage.length} garbage item(s):`,
          Current_garbage.map(
            (garbage) => `${garbage.itemName} (${garbage.itemType})`
          )
        );
      }

      // Check for bins - could be used for scoring or validation
      if (bins.length > 0) {
        console.log(
          `Detected ${bins.length} bin(s):`,
          bins.map((bin) => `${bin.itemName} (${bin.itemType})`)
        );

        const inventoryItems = await inventoryRepository.popPlayerInventory(
          matchId,
          shooterId
        );
        console.log(
          `Inventory items (${inventoryItems.length}):`,
          inventoryItems.map(
            (it) => `${it.itemName} (${it.itemType}) - CO₂ ${it.co2Savings}`
          )
        );

        // Normalize inventory to Garbage objects (defensive) and merge
        const normalizedInventory: Garbage[] = inventoryItems.map((it) => ({
          id: (it as any).id,
          itemName: it.itemName ?? "Unknown item",
          itemType: it.itemType,
          co2Savings: typeof it.co2Savings === "number" ? it.co2Savings : 0,
        }));

        Current_garbage.push(...normalizedInventory);
        console.log(
          `Combined Current_garbage (${Current_garbage.length}):`,
          Current_garbage.map(
            (g) => `${g.itemName} (${g.itemType}) - CO₂ ${g.co2Savings}`
          )
        );

        // For each bin: remove garbage of the same type (recycled correctly)
        const binToGarbageMap: Record<BinType, GarbageType | null> = {
          [BinType.FOOD_SCRAPS_BIN]: GarbageType.FOOD_SCRAPS,
          [BinType.MIXED_PAPER_BIN]: GarbageType.MIXED_PAPER,
          [BinType.RECYCLABLE_BIN]: GarbageType.RECYCLABLE,
          [BinType.LANDFILL_BIN]: GarbageType.LANDFILL,
          [BinType.UNKNOWN_BIN]: null,
        };

        const supportedTypes = new Set<GarbageType>();
        for (const b of bins) {
          const mapped = binToGarbageMap[b.itemType as BinType];
          if (mapped) supportedTypes.add(mapped);
        }

        const recyclableNow = Current_garbage.filter((g) =>
          supportedTypes.has(g.itemType)
        );
        if (recyclableNow.length > 0) {
          console.log(
            `Recycling ${recyclableNow.length} item(s) into matching bins:`,
            recyclableNow.map((g) => `${g.itemName} (${g.itemType})`)
          );
        }

        // Calculate total CO₂ savings score from recycled items
        let totalCO2Score = 0;
        const recycledItems: Garbage[] = [];

        // Remove recycled items from Current_garbage and calculate score
        if (supportedTypes.size > 0) {
          const remainingAfterRecycle = Current_garbage.filter((g) => {
            if (supportedTypes.has(g.itemType)) {
              // This item is being recycled - add to score and track it
              const itemScore = Math.max(15, g.co2Savings * 50); // Minimum 15 points, or CO₂ * 50
              totalCO2Score += itemScore;
              recycledItems.push(g);
              console.log(
                `♻️ Recycled ${g.itemName} (${g.itemType}) - CO₂ saved: ${
                  g.co2Savings
                }kg (${itemScore.toFixed(0)} points)`
              );

              // Send WebSocket event to frontend about item redemption
              const redemptionEvent = {
                type: "item_redeemed",
                data: {
                  matchId,
                  playerId: shooterId,
                  item: {
                    name: g.itemName,
                    type: g.itemType,
                    co2Savings: g.co2Savings,
                    pointsEarned: itemScore,
                  },
                  message: `♻️ Recycled ${g.itemName} - CO₂ saved: ${
                    g.co2Savings
                  }kg (${itemScore.toFixed(0)} points)`,
                },
              };

              // Broadcast to all players in the match
              wsManager.broadcast(JSON.stringify(redemptionEvent));

              return false; // Remove from Current_garbage
            }
            return true; // Keep in Current_garbage
          });

          Current_garbage.length = 0;
          Current_garbage.push(...remainingAfterRecycle);

          // Log recycling summary with total score
          if (recycledItems.length > 0) {
            console.log(
              `✅ Successfully recycled ${
                recycledItems.length
              } item(s) - Total points earned: ${totalCO2Score.toFixed(3)}`
            );
          }
        }

        // If any garbage left without matching bins, give default points
        if (Current_garbage.length > 0) {
          const defaultPoints = Current_garbage.length * 20; // 20 points per unmatched item
          totalCO2Score += defaultPoints;

          console.log(
            `🗑️ No matching bins for ${Current_garbage.length} item(s); giving default points:`,
            Current_garbage.map((g) => `${g.itemName} (${g.itemType})`)
          );
          console.log(
            `📦 Default points earned: ${defaultPoints} (20 per item)`
          );

          // Send WebSocket event for unmatched items
          const unmatchedEvent = {
            type: "items_collected",
            data: {
              matchId,
              playerId: shooterId,
              items: Current_garbage.map((g) => ({
                name: g.itemName,
                type: g.itemType,
                co2Savings: g.co2Savings,
              })),
              pointsEarned: defaultPoints,
              message: `📦 Collected ${Current_garbage.length} item(s) - ${defaultPoints} points earned`,
            },
          };

          // Broadcast to all players in the match
          wsManager.broadcast(JSON.stringify(unmatchedEvent));

          Current_garbage.length = 0; // remove remaining
        }

        // Update player score based on total points earned
        if (totalCO2Score > 0) {
          await matchManager.updatePlayerScore(
            matchId,
            shooterId,
            totalCO2Score
          );
          console.log(
            `🏆 Player ${shooterId} earned ${totalCO2Score.toFixed(
              3
            )} points total!`
          );
        }
      }

      // If no bins detected, add detected garbage items to player's inventory
      if (Current_garbage.length > 0) {
        for (const item of Current_garbage) {
          await inventoryRepository.addItemToInventory(
            matchId,
            shooterId,
            item
          );
        }
      }

      return;
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
      success = await matchManager.startMatch(matchId, adminId);
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
export async function broadcastLeaderboardUpdate(
  matchId: string,
  wsManager: WebSocketManager
): Promise<void> {
  const leaderboard = await matchManager.getLeaderboard(matchId);

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
