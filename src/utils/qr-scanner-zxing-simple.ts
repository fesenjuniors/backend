import fs from "fs";
import sharp from "sharp";
import { readBarcodesFromImageData } from "zxing-wasm/reader";

/**
 * Scan QR code using ZXing WebAssembly
 * Fast and accurate QR detection without cloud APIs
 */
export const scanQRWithZXing = async (
  imagePath: string,
  saveDebug: boolean = false
): Promise<string | null> => {
  try {
    console.log("📷 Using ZXing WASM for QR detection...\n");

    const imageBuffer = await fs.promises.readFile(imagePath);
    
    if (saveDebug) {
      const debugDir = "./debug-images";
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      await sharp(imageBuffer).png().toFile(`${debugDir}/zxing-original.png`);
      console.log(`💾 Saved original: debug-images/zxing-original.png`);
    }

    // Convert to RGBA format that ZXing expects
    const image = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    console.log("🔍 Detecting QR codes with ZXing...");

    // Create proper ImageData object
    const imageData = {
      data: new Uint8ClampedArray(image.data),
      width: image.info.width,
      height: image.info.height,
      colorSpace: "srgb" as PredefinedColorSpace,
    } as ImageData;

    const results = await readBarcodesFromImageData(imageData);

    if (results.length === 0) {
      console.log("❌ No QR codes detected\n");
      return null;
    }

    // Filter for QR codes specifically
    const qrCodes = results.filter((r: any) => r.format === "QRCode");
    
    if (qrCodes.length > 0) {
      const qr = qrCodes[0]!;
      console.log(`✅ QR Code detected: "${qr.text}"`);
      
      if (saveDebug) {
        console.log(`   Format: ${qr.format}`);
      }
      
      return qr.text;
    }

    // If no QR code but other barcodes found
    const firstResult = results[0]!;
    console.log(`⚠️  Found ${firstResult.format} (not QR): "${firstResult.text}"`);
    return firstResult.text;

  } catch (error: any) {
    console.error("Error with ZXing scanner:", error.message);
    throw error;
  }
};

/**
 * Scan QR code from base64 string
 */
export const scanQRFromBase64WithZXing = async (
  base64Image: string
): Promise<string | null> => {
  try {
    const imageBuffer = Buffer.from(base64Image, "base64");
    
    const image = await sharp(imageBuffer)
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

    if (results.length === 0) {
      return null;
    }

    const qrCodes = results.filter((r: any) => r.format === "QRCode");
    return qrCodes.length > 0 ? qrCodes[0]!.text : results[0]!.text;

  } catch (error: any) {
    console.error("ZXing error:", error.message);
    return null;
  }
};

/**
 * Advanced scan with preprocessing strategies
 */
export const scanQRWithZXingAdvanced = async (
  imagePath: string,
  outputDir: string = "./debug-images"
): Promise<string | null> => {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const imageBuffer = await fs.promises.readFile(imagePath);
    console.log("📷 ZXing with advanced preprocessing...\n");

    // Save original
    await sharp(imageBuffer).png().toFile(`${outputDir}/zxing-00-original.png`);
    console.log(`💾 Original saved`);

    // Strategy 1: Try original
    console.log("\n🔄 Strategy 1: Original image");
    let result = await tryZXingOnBuffer(imageBuffer);
    if (result) return result;

    // Strategy 2: Grayscale + sharpen
    console.log("\n🔄 Strategy 2: Grayscale + sharpen");
    const enhanced = await sharp(imageBuffer)
      .grayscale()
      .sharpen({ sigma: 2 })
      .normalize()
      .png()
      .toBuffer();
    await fs.promises.writeFile(`${outputDir}/zxing-02-enhanced.png`, enhanced);
    result = await tryZXingOnBuffer(enhanced);
    if (result) return result;

    // Strategy 3: High contrast
    console.log("\n🔄 Strategy 3: High contrast");
    const contrast = await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .linear(2, -50)
      .png()
      .toBuffer();
    await fs.promises.writeFile(`${outputDir}/zxing-03-contrast.png`, contrast);
    result = await tryZXingOnBuffer(contrast);
    if (result) return result;

    console.log(`\n❌ No QR code found after all strategies.\n`);
    return null;

  } catch (error: any) {
    console.error("Error:", error.message);
    throw error;
  }
};

/**
 * Helper: Try ZXing on a buffer
 */
async function tryZXingOnBuffer(buffer: Buffer): Promise<string | null> {
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
      console.log(`   ✅ Found: "${qr!.text}"`);
      return qr!.text;
    }

    console.log(`   ❌ Not detected`);
    return null;
  } catch (error) {
    console.log(`   ❌ Error`);
    return null;
  }
}
