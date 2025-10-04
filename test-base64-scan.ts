import fs from "fs";
import { scanQRFromBase64 } from "./src/utils/qr-base64-scanner";

async function testBase64Scan() {
  // Read an image and convert to base64
  const imagePath = process.argv[2] || "./test-qr-player-test-123.png";
  
  console.log(`📖 Reading image: ${imagePath}\n`);
  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Image = imageBuffer.toString("base64");
  
  console.log(`✅ Image encoded to base64 (${base64Image.length} characters)\n`);
  console.log("=" .repeat(60));
  
  // Scan the QR code from base64
  await scanQRFromBase64(base64Image, "./debug-images");
}

testBase64Scan().catch(console.error);
