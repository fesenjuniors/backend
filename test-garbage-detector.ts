import { detectGarbageInFile } from "./src/utils/garbage-detector";

async function testGarbageDetection() {
  const imagePath = process.argv[2];

  if (!imagePath) {
    console.log("Usage: npx ts-node test-garbage-detector.ts <image-path>");
    console.log("\nExample:");
    console.log("  npx ts-node test-garbage-detector.ts ./my-image.jpg");
    process.exit(1);
  }

  console.log("🗑️  Garbage Detection Test\n");
  console.log("=" .repeat(60) + "\n");

  try {
    const result = await detectGarbageInFile(imagePath);

    console.log("\n" + "=" .repeat(60));
    console.log("\n🎯 FINAL RESULT:");
    console.log(`   ${result.isGarbage ? "🗑️  GARBAGE DETECTED!" : "✅ NO GARBAGE"}`);
    console.log(`   Confidence: ${result.confidence.toUpperCase()}`);
    
    if (result.items && result.items.length > 0) {
      console.log(`   Items: ${result.items.join(", ")}`);
    }

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    
    if (error.message.includes("API key")) {
      console.log("\n🔑 Set your OpenAI API key:");
      console.log("   export OPENAI_API_KEY='your-key-here'");
      console.log("   or add to .env file:");
      console.log("   OPENAI_API_KEY=your-key-here");
    }
  }
}

testGarbageDetection();
