import { config as loadEnv } from "dotenv";

loadEnv();

export interface AppConfig {
  port: number;
  host: string;
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config: AppConfig = {
  port: parseNumber(process.env.PORT, 8080),
  host: process.env.HOST ?? "0.0.0.0",
};


