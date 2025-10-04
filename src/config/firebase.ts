import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let firebaseApp: App;
let db: Firestore;

/**
 * Initialize Firebase Admin SDK
 * 
 * Environment variables required:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_PRIVATE_KEY (base64 encoded or raw with escaped newlines)
 * - FIREBASE_CLIENT_EMAIL
 */
export function initializeFirebase(): void {
  if (getApps().length > 0) {
    console.log("Firebase already initialized");
    return;
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn(
        "Firebase credentials not found. Running in development mode without Firebase."
      );
      console.warn("Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY to enable Firebase.");
      return;
    }

    // Handle base64 encoded private key or escaped newlines
    if (!privateKey.includes("BEGIN PRIVATE KEY")) {
      // Assume base64 encoded
      privateKey = Buffer.from(privateKey, "base64").toString("utf8");
    } else {
      // Replace escaped newlines
      privateKey = privateKey.replace(/\\n/g, "\n");
    }

    firebaseApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    db = getFirestore(firebaseApp);
    console.log("Firebase initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    console.warn("Running in development mode without Firebase.");
  }
}

/**
 * Get Firestore database instance
 */
export function getDb(): Firestore {
  if (!db) {
    throw new Error(
      "Firebase not initialized. Call initializeFirebase() first or check your environment variables."
    );
  }
  return db;
}

/**
 * Check if Firebase is available
 */
export function isFirebaseAvailable(): boolean {
  return db !== undefined;
}
