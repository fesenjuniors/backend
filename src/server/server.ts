import http from "http";
import express from "express";
import { config } from "../config/environment";
import { initializeFirebase } from "../config/firebase";
import { registerRoutes } from "../routes/serverRoute";
import { createWebSocketManager } from "./websocket";
import { setupGameWebSocketHandlers } from "./gameWebSocket";

// Initialize Firebase
initializeFirebase();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

registerRoutes(app);

const server = http.createServer(app);

export const websocketManager = createWebSocketManager({
  server,
  path: "/ws", // WebSocket endpoint: ws://host:port/ws
});

// Setup game-specific WebSocket handlers
setupGameWebSocketHandlers(websocketManager);

server.listen(config.port, config.host, () => {
  const address = server.address();

  if (address && typeof address !== "string") {
    const baseUrl = `http://${address.address}:${address.port}`;
    console.log(`Server listening on ${baseUrl}`);
    console.log(
      `WebSocket endpoint available at ws://${address.address}:${address.port}/ws`
    );
    return;
  }

  console.log(`Server listening on ${config.host}:${config.port}`);
  console.log(
    `WebSocket endpoint available at ws://${config.host}:${config.port}/ws`
  );
});

websocketManager.on("connection", (clientCount) => {
  console.log(`WebSocket clients connected: ${clientCount}`);
});

websocketManager.on("disconnect", (clientCount) => {
  console.log(`WebSocket clients connected: ${clientCount}`);
});
