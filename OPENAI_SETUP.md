# OpenAI Vision API Setup (2 minutes)

## Get Your API Key

1. Go to: https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-...`)

## Set the API Key

### Option 1: Environment Variable
```bash
export OPENAI_API_KEY='sk-your-key-here'
```

### Option 2: Add to .env file
```bash
echo 'OPENAI_API_KEY=sk-your-key-here' >> .env
```

## Test Garbage Detection

```bash
# Test with any image
npx ts-node test-garbage-detector.ts /path/to/image.jpg
```

## Usage in Code

```typescript
import { detectGarbageInImage, detectGarbageInFile } from "./src/utils/garbage-detector";

// From file
const result = await detectGarbageInFile("./photo.jpg");

// From base64
const result = await detectGarbageInImage(base64Image);

if (result.isGarbage) {
  console.log(`Found garbage: ${result.items.join(", ")}`);
}
```

## API Endpoint Integration

```typescript
app.post("/detect-garbage", async (req, res) => {
  const { image } = req.body; // base64 image
  const result = await detectGarbageInImage(image);
  res.json(result);
});
```

## Pricing

- **gpt-4o-mini**: ~$0.00015 per image (CHEAP - recommended for hackathon)
- **gpt-4o**: ~$0.01 per image (more accurate)

For hackathon testing: Use gpt-4o-mini (it's 60x cheaper and works great!)

## What It Detects

✅ Bottles, cans, wrappers  
✅ Food waste, paper  
✅ Cigarette butts  
✅ Plastic bags  
✅ Any litter on floor/ground  

## Response Format

```json
{
  "isGarbage": true,
  "confidence": "high",
  "description": "Plastic bottle and food wrapper on concrete floor",
  "items": ["plastic bottle", "food wrapper"]
}
```
