import { config as loadEnv } from "dotenv";

loadEnv();

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  https: {
    enabled: boolean;
    port: number;
    certPath?: string;
    keyPath?: string;
  };
  firebase: {
    projectId: string | undefined;
    clientEmail: string | undefined;
    privateKey: string | undefined;
    credentialsPath: string | undefined;
  };
  game: {
    maxPlayersPerMatch: number;
    matchTimeoutMinutes: number;
  };
  qrCode: {
    size: number;
    errorCorrectionLevel: string;
  };
  imageProcessing: {
    maxSizeMB: number;
    allowedTypes: string[];
  };
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseArray = (
  value: string | undefined,
  fallback: string[]
): string[] => {
  if (!value) {
    return fallback;
  }
  return value.split(",").map((item) => item.trim());
};

const parseBoolean = (
  value: string | undefined,
  fallback: boolean
): boolean => {
  if (value === undefined || value === null) {
    return fallback;
  }
  return value.toLowerCase() === "true" || value === "1";
};

export const config: AppConfig = {
  port: parseNumber(process.env.PORT, 8080),
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",
  https: {
    enabled: parseBoolean(process.env.HTTPS_ENABLED, true), // Default to true for development
    port: parseNumber(process.env.HTTPS_PORT, 9443), // Default HTTPS port
    ...(process.env.HTTPS_CERT_PATH && {
      certPath: process.env.HTTPS_CERT_PATH,
    }),
    ...(process.env.HTTPS_KEY_PATH && { keyPath: process.env.HTTPS_KEY_PATH }),
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  game: {
    maxPlayersPerMatch: parseNumber(process.env.MAX_PLAYERS_PER_MATCH, 10),
    matchTimeoutMinutes: parseNumber(process.env.MATCH_TIMEOUT_MINUTES, 30),
  },
  qrCode: {
    size: parseNumber(process.env.QR_CODE_SIZE, 200),
    errorCorrectionLevel: process.env.QR_CODE_ERROR_CORRECTION_LEVEL ?? "M",
  },
  imageProcessing: {
    maxSizeMB: parseNumber(process.env.MAX_IMAGE_SIZE_MB, 10),
    allowedTypes: parseArray(process.env.ALLOWED_IMAGE_TYPES, [
      "image/jpeg",
      "image/png",
      "image/webp",
    ]),
  },
};
