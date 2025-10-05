import http from "http";
import https from "https";
import express from "express";
import { config } from "../config/environment";
import { initializeFirebase } from "../config/firebase";
import { registerRoutes } from "../routes/serverRoute";
import { createWebSocketManager } from "./websocket";
import { setupGameWebSocketHandlers } from "./gameWebSocket";
import { errorHandler, validateRequest } from "../middleware/errorHandler";
import { loadCertificates } from "../utils/certificateGenerator";
import { matchManager } from "../services/matchManager";

// Initialize Firebase
initializeFirebase();

const app = express();

// CORS middleware - MUST be before other middleware
app.use((req, res, next) => {
  // Allow requests from Vite frontend (adjust origins as needed)
  const allowedOrigins = [
    "http://localhost:5175",
    "https://localhost:5175",
    "http://localhost:8175",
    "https://localhost:8175",
    "http://127.0.0.1:5175",
    "https://127.0.0.1:5175",
    "https://127.0.0.1:8175",
    "http://127.0.0.1:8175",

    "*", // Allow all origins in development
  ];

  const origin = req.headers.origin;
  if (
    origin &&
    (allowedOrigins.includes("*") || allowedOrigins.includes(origin))
  ) {
    res.header("Access-Control-Allow-Origin", origin);
  } else if (allowedOrigins.includes("*")) {
    res.header("Access-Control-Allow-Origin", "*");
  }

  // Allow specific methods
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  // Allow specific headers
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  // Allow credentials
  res.header("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(validateRequest);

// Routes
registerRoutes(app);

// Global error handler (must be last)
app.use(errorHandler);

// Create HTTP server
const httpServer = http.createServer(app);

// Create HTTPS server if enabled
let httpsServer: https.Server | undefined;
if (config.https.enabled) {
  try {
    const certificateOptions: Parameters<typeof loadCertificates>[0] = {};
    if (config.https.certPath) {
      certificateOptions.certPath = config.https.certPath;
    }
    if (config.https.keyPath) {
      certificateOptions.keyPath = config.https.keyPath;
    }

    const certificates = loadCertificates(certificateOptions);

    httpsServer = https.createServer(
      {
        cert: certificates.cert,
        key: certificates.key,
      },
      app
    );

    console.log("HTTPS server created with self-signed certificates");
  } catch (error) {
    console.error("Failed to create HTTPS server:", error);
    console.log("Falling back to HTTP only");
  }
}

const server = httpsServer || httpServer;

// Create WebSocket manager for the primary server
export const websocketManager = createWebSocketManager({
  server,
  path: "/ws", // WebSocket endpoint
});

// Setup game-specific WebSocket handlers
setupGameWebSocketHandlers(websocketManager);

// Start HTTP server
httpServer.listen(config.port, config.host, async () => {
  const address = httpServer.address();
  if (address && typeof address !== "string") {
    const baseUrl = `http://${address.address}:${address.port}`;
    console.log(`\n🚀 HTTP Server listening on ${baseUrl}`);
    console.log(
      `   WebSocket endpoint: ws://${address.address}:${address.port}/ws`
    );
  }

  // Load matches from database on startup
  await matchManager.loadMatchesFromDatabase();
});

// Start HTTPS server if enabled
if (httpsServer) {
  httpsServer.listen(config.https.port, config.host, () => {
    const address = httpsServer!.address();
    if (address && typeof address !== "string") {
      const baseUrl = `https://${address.address}:${address.port}`;
      console.log(`\n🔒 HTTPS Server listening on ${baseUrl}`);
      console.log(
        `   Secure WebSocket endpoint: wss://${address.address}:${address.port}/ws`
      );
      console.log(
        `\n⚠️  Note: Using self-signed certificates. Your browser will show a security warning.`
      );
      console.log(`   Accept the certificate to continue.\n`);
    }
  });
}

websocketManager.on("connection", (clientCount) => {
  console.log(`WebSocket clients connected: ${clientCount}`);
});

websocketManager.on("disconnect", (clientCount) => {
  console.log(`WebSocket clients connected: ${clientCount}`);
});
