import http from "http";
import express from "express";
import { config } from "../config/environment";
import { registerRoutes } from "../routes";
import { createWebSocketManager } from "./websocket";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

registerRoutes(app);

const server = http.createServer(app);

export const websocketManager = createWebSocketManager({
  server,
});

server.listen(config.port, config.host, () => {
  const address = server.address();

  if (address && typeof address !== "string") {
    const baseUrl = `http://${address.address}:${address.port}`;
    console.log(`Server listening on ${baseUrl}`);
    console.log(`WebSocket endpoint available at ws://${address.address}:${address.port}`);
    return;
  }

  console.log(`Server listening on ${config.host}:${config.port}`);
});

websocketManager.on("connection", (clientCount) => {
  console.log(`WebSocket clients connected: ${clientCount}`);
});


