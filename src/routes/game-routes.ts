import type { Express, Request, Response } from "express";
import { scanQRFromBase64 } from "../utils/qr-base64-scanner";
import { detectGarbageInImage } from "../utils/garbage-detector";

/**
 * Register game-related routes
 */
export const registerGameRoutes = (app: Express): void => {
  
  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  // Scan QR code from image
  app.post("/scan-qr", async (req: Request, res: Response) => {
    try {
      const { image } = req.body;

      if (!image) {
        res.status(400).json({ error: "Missing 'image' field in request body" });
        return;
      }

      const qrCode = await scanQRFromBase64(image, "./debug-images");

      if (qrCode) {
        res.status(200).json({ success: true, qrCode });
      } else {
        res.status(404).json({ success: false, message: "No QR code found" });
      }
    } catch (error: any) {
      console.error("Error scanning QR code:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  // Detect garbage in image
  app.post("/detect-garbage", async (req: Request, res: Response) => {
    try {
      const { image } = req.body;

      if (!image) {
        res.status(400).json({ error: "Missing 'image' field in request body" });
        return;
      }

      const result = await detectGarbageInImage(image);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error("Error detecting garbage:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  // Combined: Scan QR + Detect Garbage (for game mechanics)
  app.post("/scan-and-check", async (req: Request, res: Response) => {
    try {
      const { image } = req.body;

      if (!image) {
        res.status(400).json({ error: "Missing 'image' field in request body" });
        return;
      }

      // Run both in parallel for speed
      const [qrCode, garbageResult] = await Promise.all([
        scanQRFromBase64(image, "./debug-images").catch(() => null),
        detectGarbageInImage(image).catch(() => null),
      ]);

      res.status(200).json({
        success: true,
        qrCode: qrCode || null,
        garbage: garbageResult || null,
      });
    } catch (error: any) {
      console.error("Error in combined scan:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });
};
