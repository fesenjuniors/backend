import sharp from "sharp";
import { readBarcodesFromImageData } from "zxing-wasm/reader";

/**
 * Fast parallel QR scanner - no file I/O, direct buffer processing
 * @param base64Image - Base64 encoded image (with or without data URL prefix)
 * @returns The QR code data/ID or null if not found
 */
export const scanQRFromBase64 = async (
  base64Image: string
): Promise<string | null> => {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    
    // Decode base64 to buffer - no file I/O!
    const imageBuffer = Buffer.from(base64Data, "base64");
    
    // Define scanning strategies
    const strategies = [
      // Strategy 1: Original image (fastest, works most of the time)
      {
        name: "original",
        process: async () => imageBuffer
      },
      // Strategy 2: Enhanced (grayscale + sharpen + normalize)
      {
        name: "enhanced",
        process: async () => 
          sharp(imageBuffer)
            .grayscale()
            .sharpen({ sigma: 2 })
            .normalize()
            .png()
            .toBuffer()
      },
      // Strategy 3: High contrast
      {
        name: "contrast", 
        process: async () =>
          sharp(imageBuffer)
            .grayscale()
            .normalize()
            .linear(2, -50)
            .png()
            .toBuffer()
      }
    ];
    
    // Run all strategies in PARALLEL for maximum speed
    const results = await Promise.allSettled(
      strategies.map(async (strategy) => {
        try {
          const buffer = await strategy.process();
          const result = await scanBufferWithZXing(buffer);
          if (result) {
            return { strategy: strategy.name, result };
          }
          return null;
        } catch (error) {
          return null;
        }
      })
    );
    
    // Return first successful result
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.result) {
        const { strategy, result: qrContent } = result.value;
        console.log(`✅ QR detected (${strategy} strategy): "${qrContent}"`);
        return qrContent;
      }
    }
    
    console.log("❌ No QR code found");
    return null;
    
  } catch (error: any) {
    console.error("QR scan error:", error.message);
    return null;
  }
};

/**
 * Helper: Scan a buffer directly with ZXing (no file I/O)
 */
async function scanBufferWithZXing(buffer: Buffer): Promise<string | null> {
  try {
    const image = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const imageData = {
      data: new Uint8ClampedArray(image.data),
      width: image.info.width,
      height: image.info.height,
      colorSpace: "srgb" as PredefinedColorSpace,
    } as ImageData;

    const results = await readBarcodesFromImageData(imageData);

    if (results.length > 0) {
      const qr = results.find((r: any) => r.format === "QRCode") || results[0];
      return qr!.text;
    }

    return null;
  } catch (error) {
    return null;
  }
}
