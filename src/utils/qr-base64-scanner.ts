import fs from "fs";
import { scanQRWithZXingAdvanced } from "./qr-scanner-zxing-simple";

/**
 * Scan QR code from base64 image string
 * @param base64Image - Base64 encoded image (with or without data URL prefix)
 * @param outputDir - Directory to save debug images (default: ./debug-images)
 * @returns The QR code data/ID or null if not found
 */
export const scanQRFromBase64 = async (
  base64Image: string,
  outputDir: string = "./debug-images"
): Promise<string | null> => {
  const tempFilePath = "/tmp/temp-qr-scan.png";

  try {
    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    // Decode base64 to buffer
    const imageBuffer = Buffer.from(base64Data, "base64");

    // Save to temporary file
    await fs.promises.writeFile(tempFilePath, imageBuffer);
    console.log("📥 Base64 image decoded and saved to temp file\n");

    // Scan with ZXing Advanced
    const qrId = await scanQRWithZXingAdvanced(tempFilePath, outputDir);

    if (qrId) {
      console.log(`\n🎯 QR Code ID: ${qrId}\n`);
    } else {
      console.log(`\n❌ No QR code ID found\n`);
    }

    return qrId;

  } catch (error: any) {
    console.error("Error processing base64 image:", error.message);
    throw error;
  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
};
