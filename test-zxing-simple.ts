import { scanQRWithZXing, scanQRWithZXingAdvanced } from "./src/utils/qr-scanner-zxing-simple";

const imagePath = process.argv[2] || "./src/test-pictures/IMG_6025.jpg";
const useAdvanced = process.argv[3] === "--advanced";

console.log(`🔍 Testing ZXing scanner on: ${imagePath}\n`);

if (useAdvanced) {
  scanQRWithZXingAdvanced(imagePath, "./debug-images")
    .then((result) => {
      if (result) {
        console.log(`\n🎉 SUCCESS! QR Code: ${result}`);
      } else {
        console.log(`\n❌ No QR code detected`);
      }
    })
    .catch(console.error);
} else {
  scanQRWithZXing(imagePath, true)
    .then((result) => {
      if (result) {
        console.log(`\n🎉 SUCCESS! QR Code: ${result}`);
      } else {
        console.log(`\n❌ No QR code detected`);
      }
    })
    .catch(console.error);
}
