# Task for Fellow Hackathonee

## What You Need to Implement

**File**: `src/services/shotProcessor.ts`

**Function**: `processShotImage()`

## Input

```typescript
{
  shooterId: string,     // Who is shooting
  matchId: string,       // Which match
  imageBase64: string    // Base64 image from frontend
}
```

## Output

```typescript
{
  targetId: string | null; // Player who got shot, or null if miss
}
```

## What You Need to Do

1. **Decode the base64 image**
2. **Extract QR code from the image** (using jsqr or similar)
3. **Parse the QR code JSON** to get the target player ID
4. **Return the targetId or null**

## Example Implementation

```typescript
export async function processShotImage(
  request: ShotProcessingRequest
): Promise<ShotProcessingResult> {
  try {
    // 1. Decode base64 image
    const imageBuffer = Buffer.from(request.imageBase64, "base64");

    // 2. Extract QR code from image
    const qrCodeData = await extractQrCodeFromImage(imageBuffer);

    if (!qrCodeData) {
      return { targetId: null }; // No QR found = miss
    }

    // 3. Parse QR code JSON
    const qrParsed = JSON.parse(qrCodeData);
    const targetPlayerId = qrParsed.playerId;

    // 4. Return target ID
    return { targetId: targetPlayerId };
  } catch (error) {
    console.error("Error processing shot:", error);
    return { targetId: null }; // Error = miss
  }
}
```

## Suggested Libraries

```bash
npm install jsqr jimp
```

## QR Code Format

QR codes contain JSON like this:

```json
{
  "matchId": "match_abc123",
  "playerId": "player_xyz789",
  "timestamp": "2025-01-04T12:00:00.000Z"
}
```

## That's It!

Once you implement this function, the entire shot system will work:

- ✅ Database saves
- ✅ Score updates
- ✅ Broadcasting to players
- ✅ Leaderboard updates

Everything else is already implemented!
