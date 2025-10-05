import fs from "fs";
import { detectGarbageInImage } from "../src/utils/garbage-detector";
import { GarbageType, BinType, Garbage, Bin } from "../src/types/game";

async function testGarbageWithBase64() {
  const imagePath = process.argv[2];

  if (!imagePath) {
    console.log("Usage: npx ts-node test-garbage-base64.ts <image-path>");
    process.exit(1);
  }

  console.log("🗑️  Testing Garbage Detection & Classification\n");
  console.log("=".repeat(60));

  // Step 1: Read image and convert to base64
  console.log(`\n📖 Reading image: ${imagePath}`);
  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Image = imageBuffer.toString("base64");

  console.log(`✅ Converted to base64 (${base64Image.length} characters)`);
  console.log("=".repeat(60) + "\n");

  // Step 2: Detect garbage from base64
  try {
    const result = await detectGarbageInImage(base64Image);

    console.log("\n" + "=".repeat(60));
    console.log("\n🎯 DETECTION RESULT:");

    console.log(
      `\n   Garbage items: ${
        result.garbage.length > 0 ? `🗑️  ${result.garbage.length}` : "❌ None"
      }`
    );
    console.log(
      `   Bins: ${
        result.bins.length > 0 ? `🗑️  ${result.bins.length}` : "❌ None"
      }`
    );
    console.log(`   Confidence: ${result.confidence.toUpperCase()}`);
    console.log(`   Description: ${result.description}`);

    // Display garbage items
    if (result.garbage.length > 0) {
      console.log(`\n  GARBAGE ITEMS (${result.garbage.length}):`);
      const garbageEmojis: Record<string, string> = {
        [GarbageType.FOOD_SCRAPS]: "🍎",
        [GarbageType.MIXED_PAPER]: "📄",
        [GarbageType.RECYCLABLE]: "♻️",
        [GarbageType.LANDFILL]: "🚮",
      };

      result.garbage.forEach((item: Garbage, index: number) => {
        const emoji = garbageEmojis[item.itemType] || "📦";
        console.log(`\n   ${index + 1}. ${emoji} ${item.itemName}`);
        console.log(`      └─ Type: ${item.itemType}`);
        console.log(`      └─ CO₂ Savings: ${item.co2Savings} kg`);
      });
    }

    // Display bins
    if (result.bins.length > 0) {
      console.log(`\n  BINS (${result.bins.length}):`);
      const binEmojis: Record<string, string> = {
        [BinType.FOOD_SCRAPS_BIN]: "🟢",
        [BinType.MIXED_PAPER_BIN]: "🟡",
        [BinType.RECYCLABLE_BIN]: "🔵",
        [BinType.LANDFILL_BIN]: "⚫",
        [BinType.UNKNOWN_BIN]: "⚪",
      };

      result.bins.forEach((item: Bin, index: number) => {
        const emoji = binEmojis[item.itemType] || "📦";
        console.log(`\n   ${index + 1}. ${emoji} ${item.itemName}`);
        console.log(`      └─ Type: ${item.itemType}`);
      });
    }

    // Display total CO₂ savings
    if (result.totalCO2Savings > 0) {
      console.log(`\n🌱 ENVIRONMENTAL IMPACT:`);
      console.log(`   📊 Total CO₂ Savings: ${result.totalCO2Savings} kg`);
      const trees = Math.ceil(result.totalCO2Savings * 0.05);
      console.log(
        `   🌳 Equivalent to planting ${trees} tree${trees > 1 ? "s" : ""}!`
      );
    }

    if (result.detectedItems.length === 0) {
      console.log(`\n   ❌ No items detected`);
    }

    console.log("\n" + "=".repeat(60));

    return result;
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);

    if (error.message.includes("API key")) {
      console.log("\n🔑 Setup required:");
      console.log("   export OPENAI_API_KEY='sk-your-key-here'");
    }
  }
}

testGarbageWithBase64();
