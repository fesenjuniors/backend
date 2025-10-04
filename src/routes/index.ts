import type { Express, Request, Response } from "express";
import { decodeAndScanQR } from "../utils/qr-scanner";

export const registerRoutes = (app: Express): void => {
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  // QR Code scanning endpoint
  app.post("/scan-qr", async (req: Request, res: Response) => {
    try {
      const { image } = req.body;

      if (!image) {
        res.status(400).json({ error: "Missing 'image' field in request body" });
        return;
      }

      // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Image = image.replace(/^data:image\/[a-z]+;base64,/, "");

      const qrData = await decodeAndScanQR(base64Image, false);

      if (qrData) {
        res.status(200).json({ success: true, qrCode: qrData });
      } else {
        res.status(404).json({ success: false, message: "No QR code found in image" });
      }
    } catch (error) {
      console.error("Error scanning QR code:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });
};


