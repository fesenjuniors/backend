import type { Express } from "express";
import healthRoutes from "./health";
import matchRoutes from "./match";
import shotRoutes from "./shots";

export const registerRoutes = (app: Express): void => {
  // Register all route modules
  app.use(healthRoutes);
  app.use(matchRoutes);
  app.use(shotRoutes);
};

