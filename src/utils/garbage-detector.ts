import OpenAI from "openai";
import fs from "fs";
import { config as loadEnv } from "dotenv";
import {
  GarbageType,
  BinType,
  Garbage,
  Bin,
  DetectedItem,
  DetectionResult,
} from "../types/game";

// Load environment variables
loadEnv();

// Re-export for backward compatibility
export { GarbageType, BinType };
export type { Garbage, Bin, DetectedItem, DetectionResult };

/**
 * Detect garbage and bins in image using OpenAI Vision
 * @param base64Image - Base64 encoded image (with or without data URL prefix)
 * @returns Detection result with garbage type and/or bin type
 */
export const detectGarbageInImage = async (
  base64Image: string
): Promise<DetectionResult> => {
  const startTime = Date.now();

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log("🤖 Using OpenAI Vision to detect garbage and bins...");
    console.log("⏱️  Timer started...\n");

    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

    // Time the API call
    const apiStartTime = Date.now();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image and detect all items (garbage and bins).
            
              CRITICAL CONTEXT RULES (avoid false positives):
              - Do NOT classify printed graphics, icons, logos, stickers, or text on bins/signs as garbage.
              - Garbage must be a physical, loose 3D object separate from a container (on the floor/ground or being held).
              - If an object appears as a flat decal on a bin surface, classify only the BIN; do not add a garbage item.
              - Use depth/3D cues (shadows, occlusion, texture) to confirm a real object. When unsure, prefer "bin" and set low confidence.
            
              ITEM TYPES (9 categories):
            
              GARBAGE TYPES (items on floor/ground):
              - "Food scraps": Food waste, leftovers, peels, organic waste
              - "Mixed Paper": Paper, cardboard, newspapers, magazines
              - "Recyclable": Bottles, cans, plastic containers, glass
              - "Landfill": Non-recyclable plastic, wrappers, cigarette butts, mixed waste
            
              BIN TYPES (waste containers - identify by color/labels):
              - "Food scraps bin": GREEN sign/label (organic waste bin)
              - "Mixed Paper bin": YELLOW sign/label (paper recycling bin)
              - "Recyclable bin": BLUE sign/label (bottles/cans/containers)
              - "Landfill bin": GREY sign/label (general trash)
              - "Unknown bin": Clearly a bin but can't identify which type
            
              CO₂ SAVINGS
              Estimate the potential CO₂ savings in kg if the detected GARBAGE item were correctly recycled/composted instead of landfilled (bins always 0).
            
              HOW TO ESTIMATE (internal reasoning, do NOT include extra fields in output):
              1) Identify the specific item and infer material (e.g., aluminum can, PET bottle, glass bottle/jar, cardboard, mixed paper, food waste, plastic film/multilayer snack wrapper).
              2) Estimate item mass (grams). If uncertain, use conservative defaults:
                 - Aluminum can: 14 g
                 - Steel can: 30 g
                 - PET plastic bottle (500 mL): 20 g
                 - HDPE rigid container (small): 25 g
                 - Glass bottle (330–500 mL): 400 g
                 - Cardboard cup/small box: 12 g
                 - Mixed paper sheet/newspaper: 5 g
                 - Food waste small item (apple core/peel): 50 g
                 - Plastic film/multilayer snack wrapper: 6 g
              3) Map material → benefit factor (kg CO₂e per kg) for correct diversion:
                 - Aluminum can → 9.0
                 - Steel can → 1.8
                 - PET/HDPE rigid plastic → 1.5
                 - Glass → 0.3
                 - Mixed paper/cardboard → 1.0
                 - Food scraps (compost vs landfill) → 0.6
                 - Plastic film/multilayer wrappers, styrofoam, mixed/contaminated → 0.0 (not curbside recyclable)
              4) Compute: co2Savings = (mass_g / 1000) × factor. Round to 3 decimals.
                 - If the correct bin would be "Landfill bin" (i.e., not recyclable/compostable), set co2Savings = 0.
                 - If material is unclear, set co2Savings = 0 and lower confidence.
            
              Return ONLY valid JSON with this exact format:
              {
                "detectedItems": [
                  {
                    "itemName": "plastic water bottle",
                    "itemType": "Recyclable",
                    "co2Savings": 0.5
                  },
                  {
                    "itemName": "blue recycling bin",
                    "itemType": "Recyclable bin",
                    "co2Savings": 0
                  }
                ],
                "confidence": "high" | "medium" | "low",
                "description": "Brief description of the scene"
              }
            
              RULES:
              - List EVERY item you see (both garbage and bins).
              - itemName: Be specific (e.g., "plastic water bottle", not just "bottle").
              - itemType: MUST be one of the 9 exact types listed above.
              - co2Savings: Only for GARBAGE items (bins get 0).
              - Only detect garbage if clearly on floor/ground (not in bins or printed on bins).
              - If the correct destination is Landfill or material is unclear → co2Savings = 0.
              - If only bins are visible, list the bins and return co2Savings = 0 for all.
              - If nothing detected, return empty detectedItems array [].
              - Be accurate with bin color/label identification for proper classification.
              - Do NOT include any fields other than those specified in the JSON format.`,
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
      max_tokens: 400,
    });

    const apiEndTime = Date.now();
    const apiCallMs = apiEndTime - apiStartTime;

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const endTime = Date.now();
    const totalMs = endTime - startTime;

    // Validate and process detected items
    const detectedItems: DetectedItem[] = [];
    const garbage: Garbage[] = [];
    const bins: Bin[] = [];

    const allTypes = [...Object.values(GarbageType), ...Object.values(BinType)];
    const garbageTypes = Object.values(GarbageType);
    const binTypes = Object.values(BinType);

    if (parsed.detectedItems && Array.isArray(parsed.detectedItems)) {
      for (const item of parsed.detectedItems) {
        // Validate item type
        if (!allTypes.includes(item.itemType)) {
          console.warn(`Invalid item type: ${item.itemType}, skipping item`);
          continue;
        }

        const itemName = item.itemName || "Unknown item";

        // Create appropriate object based on type
        if (garbageTypes.includes(item.itemType)) {
          // It's garbage
          const garbageItem: Garbage = {
            itemName,
            itemType: item.itemType as GarbageType,
            co2Savings: item.co2Savings || 0,
          };
          garbage.push(garbageItem);
          detectedItems.push(garbageItem);
        } else if (binTypes.includes(item.itemType)) {
          // It's a bin
          const binItem: Bin = {
            itemName,
            itemType: item.itemType as BinType,
          };
          bins.push(binItem);
          detectedItems.push(binItem);
        }
      }
    }

    // Calculate total CO₂ savings from garbage only
    const totalCO2Savings = garbage.reduce(
      (sum, item) => sum + item.co2Savings,
      0
    );
    const roundedTotal = Math.round(totalCO2Savings * 100) / 100;

    // Build result
    const result: DetectionResult = {
      detectedItems,
      garbage,
      bins,
      totalCO2Savings: roundedTotal,
      confidence: parsed.confidence || "low",
      description: parsed.description || "No description",
    };

    return result;
  } catch (error: any) {
    const endTime = Date.now();
    const totalMs = endTime - startTime;
    console.error(`\n❌ Error after ${totalMs}ms:`, error.message);
    throw error;
  }
};

/**
 * Detect garbage from image file path
 */
export const detectGarbageInFile = async (
  imagePath: string
): Promise<DetectionResult> => {
  console.log(`📸 Reading image: ${imagePath}\n`);
  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Image = imageBuffer.toString("base64");
  return detectGarbageInImage(base64Image);
};
