import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";

const router = createRouter();

/**
 * Health check endpoint
 * GET /health
 */
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

export default router;
