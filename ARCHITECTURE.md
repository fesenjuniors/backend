# Game Server Architecture

## Overview

This is a real-time multiplayer game server where players scan QR codes to determine hits/shots. The system uses WebSockets for real-time communication, REST API for match management, and Firebase for persistent storage.

## Architecture Flow

### Shot Processing Flow (Clarified)

1. **Frontend** → Sends base64 image via WebSocket (`shot:attempt` event)
2. **Shot Handler** (`shotHandler.ts`) → Receives the event and validates match/player
3. **Shot Processor** (`shotProcessor.ts`) → **Another hackathonee implements** image processing/AI
4. **Shot Handler** → Receives processing result, saves to database
5. **Shot Handler** → Updates player scores if hit
6. **Shot Handler** → Broadcasts `shot:result` and `leaderboard:update` to all players

### Module Separation

- **WebSocket Layer** (`websocket.ts`, `gameWebSocket.ts`) → Handles connections and message routing
- **Match Management** (`matchManager.ts`) → Manages matches, players, and game state
- **Shot Processing** (`shotProcessor.ts`) → **Image processing and AI validation (TO BE IMPLEMENTED BY ANOTHER HACKATHONEE)**
- **Shot Handling** (`shotHandler.ts`) → Orchestrates shot flow, DB saves, and broadcasting
- **Routes** (`routes/*.ts`) → REST API endpoints for match and player management

## Code Structure

```
src/
├── config/
│   └── environment.ts          # Environment configuration
├── routes/
│   ├── serverRoute.ts          # Route registration
│   ├── health.ts               # Health check endpoint
│   ├── match.ts                # Match management endpoints
│   └── shots.ts                # Shot logs and stats endpoints
├── server/
│   ├── server.ts               # Main server setup
│   ├── websocket.ts            # Low-level WebSocket manager
│   └── gameWebSocket.ts        # Game-specific WebSocket handlers
├── services/
│   ├── matchManager.ts         # Match and player management
│   ├── shotHandler.ts          # Shot orchestration, DB saves, broadcasting
│   └── shotProcessor.ts        # Image processing and AI (TO BE IMPLEMENTED)
└── types/
    ├── game.ts                 # Type definitions for game entities
    └── global.d.ts             # Global type declarations
```

## Responsibilities

### Your Code (Current Developer) ✅

- ✅ Match and player management (`matchManager.ts`)
- ✅ WebSocket connection handling (`websocket.ts`, `gameWebSocket.ts`)
- ✅ Shot flow orchestration (`shotHandler.ts`)
- ✅ Database integration (save shot logs, update scores)
- ✅ Broadcasting results to all players
- ⏳ Firebase integration (marked with TODO comments)

### Another Hackathonee 🔨

- ⏳ Image processing (`shotProcessor.ts` - interface provided)
- ⏳ QR code extraction from base64 images
- ⏳ AI/ML validation of shots
- ⏳ Shot quality analysis (aim, distance, angle)

## Core Components

### 1. Match/Lobby System

- **Match**: A game session that contains multiple players
- **Match States**: `waiting`, `active`, `ended`
- Each match has a unique ID
- Players join matches using match ID
- Match tracks player scores, shots fired, and game state

### 2. Player System

- Each player gets a unique ID when joining a match
- **QR Code**: Generated for each player (contains playerId + matchId as JSON)
- Players connect via WebSocket when joining a match
- Player states: `connected`, `disconnected`, `eliminated`

### 3. Database Schema (Firebase)

```
matches/
  {matchId}/
    id: string
    createdAt: timestamp
    startedAt?: timestamp
    endedAt?: timestamp
    state: "waiting" | "active" | "ended"
    players: {
      {playerId}: {
        id: string
        name: string
        qrCode: string
        score: number
        shots: number
        state: "connected" | "disconnected" | "eliminated"
        joinedAt: timestamp
      }
    }

matchLogs/
  {matchId}/
    shots/
      {shotId}/
        shotId: string
        shooterId: string
        targetId: string
        timestamp: timestamp
        hit: boolean
        confidence: number
        imageUrl?: string
```

## WebSocket Events

### Client → Server Events

#### 1. `player:connect`

**Purpose**: Player announces connection to match  
**Payload**:

```json
{
  "matchId": "string",
  "playerId": "string"
}
```

**Response**: Server broadcasts `player:joined` to all clients in match

#### 2. `player:disconnect`

**Purpose**: Player leaves match  
**Payload**:

```json
{
  "matchId": "string",
  "playerId": "string"
}
```

**Response**: Server broadcasts `player:left` to all clients in match

#### 3. `shot:attempt` ✅ IMPLEMENTED

**Purpose**: Player attempts to shoot another player by scanning QR  
**Payload**:

```json
{
  "matchId": "string",
  "shooterId": "string",
  "targetQrData": "string",
  "imageData": "string" // base64 encoded image
}
```

**Response**:

- Image processing/AI validation (by another hackathonee)
- Broadcast `shot:result` if successful
- Update DB with shot log
- Broadcast `leaderboard:update`

### Server → Client Events

#### 1. `match:state`

**Purpose**: Send current match state to client  
**Payload**:

```json
{
  "matchId": "string",
  "state": "waiting" | "active" | "ended",
  "players": [
    {
      "id": "string",
      "name": "string",
      "score": 0,
      "state": "connected"
    }
  ]
}
```

#### 2. `player:joined`

**Purpose**: Notify all clients when a player joins  
**Payload**:

```json
{
  "matchId": "string",
  "player": {
    "id": "string",
    "name": "string",
    "qrCode": "string"
  }
}
```

#### 3. `player:left`

**Purpose**: Notify all clients when a player leaves  
**Payload**:

```json
{
  "matchId": "string",
  "playerId": "string"
}
```

#### 4. `leaderboard:update`

**Purpose**: Broadcast updated scores to all players  
**Payload**:

```json
{
  "matchId": "string",
  "leaderboard": [
    {
      "playerId": "string",
      "playerName": "string",
      "score": 10,
      "shots": 15
    }
  ]
}
```

#### 5. `shot:result` ✅ IMPLEMENTED

**Purpose**: Broadcast shot result after processing  
**Payload**:

```json
{
  "matchId": "string",
  "shotId": "string",
  "shooterId": "string",
  "targetId": "string",
  "hit": true,
  "timestamp": "ISO8601"
}
```

#### 6. `match:started`

**Purpose**: Notify all players that match has started  
**Payload**:

```json
{
  "matchId": "string",
  "startedAt": "ISO8601"
}
```

#### 7. `match:ended`

**Purpose**: Notify all players that match has ended  
**Payload**:

```json
{
  "matchId": "string",
  "endedAt": "ISO8601",
  "winner": {
    "playerId": "string",
    "playerName": "string",
    "score": 20
  }
}
```

#### 8. `shot:error`

**Purpose**: Notify about shot processing errors  
**Payload**:

```json
{
  "matchId": "string",
  "shooterId": "string",
  "error": "string"
}
```

## REST API Endpoints

### Match Management

#### `POST /api/match/create`

Create a new match

**Response**:

```json
{
  "matchId": "string",
  "createdAt": "ISO8601"
}
```

#### `GET /api/match/:matchId`

Get match details

**Response**:

```json
{
  "id": "string",
  "state": "waiting",
  "players": [...],
  "createdAt": "ISO8601"
}
```

#### `POST /api/match/:matchId/start`

Start a match (changes state to active)

**Response**:

```json
{
  "matchId": "string",
  "state": "active",
  "startedAt": "ISO8601"
}
```

#### `POST /api/match/:matchId/end`

End a match

**Response**:

```json
{
  "matchId": "string",
  "state": "ended",
  "endedAt": "ISO8601",
  "winner": {...}
}
```

### Player Management

#### `POST /api/match/:matchId/join`

Join a match as a player

**Request Body**:

```json
{
  "playerName": "string"
}
```

**Response**:

```json
{
  "playerId": "string",
  "playerName": "string",
  "qrCode": "string",
  "matchId": "string"
}
```

#### `GET /api/match/:matchId/leaderboard`

Get current leaderboard

**Response**:

```json
{
  "matchId": "string",
  "leaderboard": [...]
}
```

### Shot Logs ✅ NEW

#### `GET /api/match/:matchId/shots`

Get all shot logs for a match

**Response**:

```json
{
  "matchId": "string",
  "totalShots": 15,
  "shots": [
    {
      "shotId": "string",
      "shooterId": "string",
      "targetId": "string",
      "hit": true,
      "confidence": 0.95,
      "timestamp": "ISO8601"
    }
  ]
}
```

#### `GET /api/match/:matchId/player/:playerId/stats`

Get shot statistics for a specific player

**Response**:

```json
{
  "matchId": "string",
  "playerId": "string",
  "totalShots": 10,
  "hits": 7,
  "misses": 3,
  "accuracy": 0.7
}
```

## Data Flow Examples

### Player Joining Match

1. Client: `POST /api/match/{matchId}/join` with playerName
2. Server: Creates player record, generates QR code
3. Server: Returns playerId and qrCode
4. Client: Connects to WebSocket
5. Client: Sends `player:connect` event
6. Server: Broadcasts `player:joined` to all clients
7. Server: Sends `match:state` to new player

### Shot Processing (Complete Flow) ✅

1. Client: Sends `shot:attempt` via WebSocket with base64 image
2. Server (`gameWebSocket.ts`): Routes to `shotHandler.handleShotAttempt()`
3. Server (`shotHandler.ts`): Validates match, player, and QR code
4. Server (`shotHandler.ts`): Calls `shotProcessor.processShotImage()` **(implemented by another hackathonee)**
5. Server (`shotProcessor.ts`): Processes image, validates QR, uses AI to determine hit
6. Server (`shotHandler.ts`): Receives result, saves shot log to database
7. Server (`shotHandler.ts`): Updates shooter's score if hit
8. Server (`shotHandler.ts`): Broadcasts `shot:result` to all clients
9. Server (`shotHandler.ts`): Broadcasts `leaderboard:update` to all clients

## QR Code Format

Each player's QR code contains JSON:

```json
{
  "matchId": "string",
  "playerId": "string",
  "timestamp": "ISO8601"
}
```

## Technology Stack

- **Runtime**: Node.js + TypeScript
- **Web Framework**: Express
- **WebSocket**: ws library
- **Database**: Firebase (Firestore) - TO BE INTEGRATED
- **QR Code Generation**: Built-in (JSON strings)
- **Image Processing**: TO BE IMPLEMENTED by another hackathonee in `shotProcessor.ts`

## Integration Points for Another Hackathonee

### Shot Processor Implementation (`src/services/shotProcessor.ts`)

The other hackathonee needs to implement the `processShotImage` function:

```typescript
export async function processShotImage(
  request: ShotProcessingRequest
): Promise<ShotProcessingResult>;
```

**Input** (`ShotProcessingRequest`):

- `shooterId`: ID of the shooter
- `matchId`: ID of the match
- `imageBase64`: Base64 encoded image from frontend
- `targetQrData`: Expected QR code data

**Output** (`ShotProcessingResult`):

- `hit`: boolean - whether the shot is valid
- `targetPlayerId`: string - ID of the target player (from QR)
- `confidence`: number - confidence score (0.0 to 1.0)
- `error`: string (optional) - error message if processing failed

**Implementation Requirements**:

1. Decode base64 image to buffer
2. Validate image format and quality
3. Extract QR code from image
4. Validate QR code matches `targetQrData`
5. Parse QR code to get `targetPlayerId`
6. Use AI/ML to validate shot quality (aim, distance, proper framing)
7. Return result with confidence score

## Next Steps

### Completed ✅

1. ✅ Set up match and player type definitions
2. ✅ Implement match management service
3. ✅ Create REST API routes
4. ✅ Enhance WebSocket manager with game events
5. ✅ Create shot handler service
6. ✅ Create shot processor interface
7. ✅ Add shot logs and stats endpoints

### TODO ⏳

1. ⏳ Install and configure Firebase
2. ⏳ Implement Firebase integration in `matchManager.ts` and `shotHandler.ts`
3. ⏳ Implement shot processor (`shotProcessor.ts`) - **Another hackathonee**
4. ⏳ Add proper error handling and logging
5. ⏳ Add authentication/authorization
6. ⏳ Add rate limiting for shot attempts
7. ⏳ Add tests

## Production Considerations

- All database operations are marked with `// TODO: Save to Firebase` comments
- In-memory storage is used temporarily for development
- Error handling is in place for all async operations
- TypeScript strict mode enabled for type safety
- Modular architecture for easy maintenance and testing
- Clear separation between infrastructure (WebSocket) and business logic (game rules)
