import http from "http";
import fs from "fs";
import WebSocket from "ws";
import { config as loadEnv } from "dotenv";

// Load environment variables
loadEnv();

import {
  initializeFirebase,
  getDb,
  isFirebaseAvailable,
} from "../src/config/firebase";

// Initialize Firebase once at startup so repository writes actually persist
initializeFirebase();

const WS_URL = process.env.TEST_WS_URL || "ws://localhost:8080/ws";
const HTTP_URL = process.env.TEST_HTTP_URL || "http://localhost:8080";

async function createMatch(
  adminName: string
): Promise<{ matchId: string; adminId: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(`${HTTP_URL}/api/match/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    req.on("response", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.matchId || !parsed.adminId)
            return reject(new Error("Invalid response creating match"));
          resolve({ matchId: parsed.matchId, adminId: parsed.adminId });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(JSON.stringify({ adminName }));
    req.end();
  });
}

async function joinPlayer(
  matchId: string,
  playerName: string,
  playerId?: string
): Promise<{ playerId: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(`${HTTP_URL}/api/match/${matchId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    req.on("response", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.player || !parsed.player.id)
            return reject(new Error("Invalid response joining player"));
          resolve({ playerId: parsed.player.id });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(
      JSON.stringify({ playerName, ...(playerId ? { playerId } : {}) })
    );
    req.end();
  });
}

async function startMatchOverWs(
  matchId: string,
  adminId: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          type: "player:connect",
          data: { matchId, playerId: adminId },
        })
      );
    });

    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "match:state") {
        ws.send(
          JSON.stringify({
            type: "admin:action",
            data: { matchId, adminId, action: "start" },
          })
        );
      }
      if (msg.type === "match:started") {
        ws.close();
        resolve();
      }
      if (msg.type === "error") {
        ws.close();
        reject(new Error(msg.data?.message || "WebSocket error"));
      }
    });

    ws.on("error", (err) => reject(err));

    setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error("WebSocket start timeout"));
    }, 20000);
  });
}

async function sendShot(
  matchId: string,
  shooterId: string,
  imagePath: string
): Promise<void> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          type: "player:connect",
          data: { matchId, playerId: shooterId },
        })
      );
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "match:state") {
        ws.send(
          JSON.stringify({
            type: "shot:attempt",
            data: { matchId, shooterId, imageData: base64Image },
          })
        );
      }
      if (msg.type === "shot:result") {
        ws.close();
        resolve();
      }
      if (msg.type === "error") {
        ws.close();
        reject(new Error(msg.data?.message || "WebSocket error"));
      }
    });
    ws.on("error", (err) => reject(err));
    setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error("WebSocket shot timeout"));
    }, 20000);
  });
}

async function sendTwoShots(
  matchId: string,
  shooterId: string,
  imagePath1: string,
  imagePath2: string
): Promise<void> {
  const imageBuffer1 = fs.readFileSync(imagePath1);
  const imageBuffer2 = fs.readFileSync(imagePath2);
  const base64Image1 = imageBuffer1.toString("base64");
  const base64Image2 = imageBuffer2.toString("base64");

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    let sentFirst = false;
    let sentSecond = false;

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          type: "player:connect",
          data: { matchId, playerId: shooterId },
        })
      );
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "match:state" && !sentFirst) {
          // Send first image immediately after receiving match state
          ws.send(
            JSON.stringify({
              type: "shot:attempt",
              data: { matchId, shooterId, imageData: base64Image1 },
            })
          );
          sentFirst = true;
          // Send the second image shortly after to avoid race conditions
          console.log("FIRST GARBAGE DONE, GOING TO SEC");
          setTimeout(() => {
            if (!sentSecond) {
              ws.send(
                JSON.stringify({
                  type: "shot:attempt",
                  data: { matchId, shooterId, imageData: base64Image2 },
                })
              );
              sentSecond = true;
              // Give the server a moment to process then close
              setTimeout(() => {
                try {
                  ws.close();
                } catch {}
                resolve();
              }, 800);
            }
          }, 350);
        }
        if (msg.type === "error") {
          try {
            ws.close();
          } catch {}
          reject(new Error(msg.data?.message || "WebSocket error"));
        }
      } catch (err) {
        try {
          ws.close();
        } catch {}
        reject(err as Error);
      }
    });

    ws.on("error", (err) => reject(err));

    setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error("WebSocket two-shots timeout"));
    }, 20000);
  });
}

async function verifyInFirebase(
  matchId: string,
  adminId: string,
  playerId: string
): Promise<void> {
  if (!isFirebaseAvailable()) {
    console.log("[WARN] Firebase not configured; skipping DB verification");
    return;
  }
  const db = getDb();

  // Verify match doc exists
  const matchDoc = await db.collection("matches").doc(matchId).get();
  if (!matchDoc.exists)
    throw new Error(`Match ${matchId} not found in Firebase`);

  // Verify admin player doc exists
  const adminDoc = await db
    .collection("matches")
    .doc(matchId)
    .collection("players")
    .doc(adminId)
    .get();
  if (!adminDoc.exists)
    throw new Error(`Admin ${adminId} not found in Firebase`);

  // Verify joined player doc exists
  const playerDoc = await db
    .collection("matches")
    .doc(matchId)
    .collection("players")
    .doc(playerId)
    .get();
  if (!playerDoc.exists)
    throw new Error(`Player ${playerId} not found in Firebase`);
}

async function run() {
  console.log("🧪 WebSocket + Firebase integration test starting...");
  const { matchId, adminId } = await createMatch("Test Admin");
  console.log("Created match", { matchId, adminId });

  const { playerId } = await joinPlayer(matchId, "Test Player 2", "123");
  console.log("Joined player", { playerId });

  await startMatchOverWs(matchId, adminId);
  console.log("Match started over WebSocket");

  // Send two images sequentially for a single player (admin)
  const imagePath1 = "./debug-images/20251004_193629.jpg";
  const imagePath2 = "./debug-images/20251004_193737.jpg";
  await sendTwoShots(matchId, adminId, imagePath1, imagePath2);
  console.log("Sent two shots sequentially");

  await new Promise((r) => setTimeout(r, 1000)); // allow async Firebase writes to flush
  await verifyInFirebase(matchId, adminId, playerId);
  console.log("✅ Verified match and players exist in Firebase");

  console.log("🎉 Test completed successfully");
}

if (require.main === module) {
  run().catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  });
}
