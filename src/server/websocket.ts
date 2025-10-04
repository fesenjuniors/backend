import { EventEmitter } from "node:events";
import type { Server as HttpServer } from "node:http";
import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";

export interface WebSocketManagerOptions {
  server: HttpServer;
  path?: string;
}

export type ClientId = string;

type WebSocketEventMap = {
  connection: [clientCount: number];
  message: [clientId: ClientId, data: string, ws: WebSocket];
  disconnect: [clientCount: number];
};

export type WebSocketManagerEvents = {
  [K in keyof WebSocketEventMap]: (...args: WebSocketEventMap[K]) => void;
};

export interface WebSocketManager {
  on<U extends keyof WebSocketEventMap>(event: U, listener: (...args: WebSocketEventMap[U]) => void): WebSocketManager;
  off<U extends keyof WebSocketEventMap>(event: U, listener: (...args: WebSocketEventMap[U]) => void): WebSocketManager;
  broadcast(data: string | Buffer | ArrayBufferLike | ArrayBufferView): void;
  clientCount(): number;
}

export const createWebSocketManager = ({ server, path = "/ws" }: WebSocketManagerOptions): WebSocketManager => {
  const events = new EventEmitter();
  const wss = new WebSocketServer({ server, path });
  const clients = new Map<ClientId, WebSocket>();

  let nextClientId = 1;

  const broadcast = (data: string | Buffer | ArrayBufferLike | ArrayBufferView) => {
    for (const ws of clients.values()) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  };

  const clientCount = () => clients.size;

  wss.on("connection", (socket) => {
    const clientId = `client-${nextClientId++}`;
    clients.set(clientId, socket);
    events.emit("connection", clientCount());

    socket.on("message", (data) => {
      const normalizedMessage = typeof data === "string" ? data : data.toString();
      events.emit("message", clientId, normalizedMessage, socket);
    });

    socket.on("close", () => {
      clients.delete(clientId);
      events.emit("disconnect", clientCount());
    });

    socket.on("error", (error) => {
      console.error(`WebSocket error for ${clientId}`, error);
    });
  });

  wss.on("error", (error) => {
    console.error("WebSocket server error", error);
  });

  return {
    on(event, listener) {
      events.on(event, listener);
      return this;
    },
    off(event, listener) {
      events.off(event, listener);
      return this;
    },
    broadcast,
    clientCount,
  };
};


