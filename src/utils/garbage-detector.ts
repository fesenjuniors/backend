import OpenAI from "openai";
import fs from "fs";

/**
 * Detect if an image contains garbage on the floor using OpenAI Vision
 * @param base64Image - Base64 encoded image (with or without data URL prefix)
 * @returns Object with detection result and details
 */
export const detectGarbageInImage = async (
  base64Image: string
): Promise<{
  isGarbage: boolean;
  confidence: "high" | "medium" | "low";
  description: string;
  items?: string[];
}> => {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log("🤖 Using OpenAI Vision to detect garbage...\n");

    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // gpt-4o-mini is cheaper, use gpt-4o for best accuracy
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and determine if there is garbage or litter on the floor/ground.

Instructions:
1. Look for any trash, litter, or waste items on the floor or ground
2. Common garbage includes: bottles, cans, food wrappers, paper, cigarette butts, plastic bags, etc.
3. Return ONLY a valid JSON response with this exact format:
{
  "isGarbage": true or false,
  "confidence": "high", "medium", or "low",
  "description": "Brief description of what you see",
  "items": ["list", "of", "garbage", "items"] or empty array if no garbage
}

Be strict: Only mark as garbage if you clearly see litter on the floor/ground.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    console.log("📄 Raw response:", content);

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from response");
    }

    const result = JSON.parse(jsonMatch[0]);

    console.log("\n✅ Detection result:");
    console.log(`   Garbage detected: ${result.isGarbage ? "YES" : "NO"}`);
    console.log(`   Confidence: ${result.confidence}`);
    console.log(`   Description: ${result.description}`);
    if (result.items && result.items.length > 0) {
      console.log(`   Items found: ${result.items.join(", ")}`);
    }

    return result;
  } catch (error: any) {
    console.error("Error detecting garbage:", error.message);
    throw error;
  }
};

/**
 * Detect garbage from image file path
 */
export const detectGarbageInFile = async (
  imagePath: string
): Promise<{
  isGarbage: boolean;
  confidence: "high" | "medium" | "low";
  description: string;
  items?: string[];
}> => {
  console.log(`📸 Reading image: ${imagePath}\n`);
  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Image = imageBuffer.toString("base64");
  return detectGarbageInImage(base64Image);
};
