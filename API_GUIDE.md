# API Usage Guide

## Quick Start

### 1. Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:8080` (or your configured port).

## REST API Endpoints

### Health Check

```
GET /health
```

Response:

```json
{
  "status": "ok"
}
```

### Create a Match

```
POST /api/match/create
```

Response:

```json
{
  "matchId": "match_abc123",
  "createdAt": "2025-10-04T12:00:00.000Z"
}
```

### Join a Match

```
POST /api/match/:matchId/join
```

Request Body:

```json
{
  "playerName": "Player1"
}
```

Response:

```json
{
  "playerId": "player_xyz789",
  "playerName": "Player1",
  "qrCode": "{\"matchId\":\"match_abc123\",\"playerId\":\"player_xyz789\",\"timestamp\":\"2025-10-04T12:00:00.000Z\"}",
  "matchId": "match_abc123"
}
```

### Get Match Details

```
GET /api/match/:matchId
```

Response:

```json
{
  "id": "match_abc123",
  "state": "waiting",
  "players": [
    {
      "id": "player_xyz789",
      "name": "Player1",
      "score": 0,
      "shots": 0,
      "state": "connected",
      "joinedAt": "2025-10-04T12:00:00.000Z"
    }
  ],
  "createdAt": "2025-10-04T12:00:00.000Z"
}
```

### Start a Match

```
POST /api/match/:matchId/start
```

Response:

```json
{
  "matchId": "match_abc123",
  "state": "active",
  "startedAt": "2025-10-04T12:01:00.000Z"
}
```

### Get Leaderboard

```
GET /api/match/:matchId/leaderboard
```

Response:

```json
{
  "matchId": "match_abc123",
  "leaderboard": [
    {
      "playerId": "player_xyz789",
      "playerName": "Player1",
      "score": 10,
      "shots": 5
    }
  ]
}
```

### End a Match

```
POST /api/match/:matchId/end
```

Response:

```json
{
  "matchId": "match_abc123",
  "state": "ended",
  "endedAt": "2025-10-04T12:30:00.000Z",
  "winner": {
    "playerId": "player_xyz789",
    "playerName": "Player1",
    "score": 20
  }
}
```

## WebSocket Connection

### Connect to WebSocket

```
ws://localhost:8080/ws
```

### Client → Server Events

#### Player Connect

After joining a match via REST API, connect to WebSocket and send:

```json
{
  "type": "player:connect",
  "data": {
    "matchId": "match_abc123",
    "playerId": "player_xyz789"
  }
}
```

#### Player Disconnect

```json
{
  "type": "player:disconnect",
  "data": {
    "matchId": "match_abc123",
    "playerId": "player_xyz789"
  }
}
```

#### Shot Attempt (TO BE IMPLEMENTED)

```json
{
  "type": "shot:attempt",
  "data": {
    "matchId": "match_abc123",
    "shooterId": "player_xyz789",
    "targetQrData": "{\"matchId\":\"...\",\"playerId\":\"...\"}",
    "imageData": "base64_encoded_image"
  }
}
```

### Server → Client Events

#### Match State (sent on connection)

```json
{
  "type": "match:state",
  "data": {
    "matchId": "match_abc123",
    "state": "active",
    "players": [...]
  }
}
```

#### Player Joined

```json
{
  "type": "player:joined",
  "data": {
    "matchId": "match_abc123",
    "player": {
      "id": "player_xyz789",
      "name": "Player1",
      "qrCode": "..."
    }
  }
}
```

#### Player Left

```json
{
  "type": "player:left",
  "data": {
    "matchId": "match_abc123",
    "playerId": "player_xyz789"
  }
}
```

#### Match Started

```json
{
  "type": "match:started",
  "data": {
    "matchId": "match_abc123",
    "startedAt": "2025-10-04T12:01:00.000Z"
  }
}
```

#### Match Ended

```json
{
  "type": "match:ended",
  "data": {
    "matchId": "match_abc123",
    "endedAt": "2025-10-04T12:30:00.000Z",
    "winner": {
      "playerId": "player_xyz789",
      "playerName": "Player1",
      "score": 20
    }
  }
}
```

#### Leaderboard Update

```json
{
  "type": "leaderboard:update",
  "data": {
    "matchId": "match_abc123",
    "leaderboard": [
      {
        "playerId": "player_xyz789",
        "playerName": "Player1",
        "score": 10,
        "shots": 5
      }
    ]
  }
}
```

## Example Flow

### Complete Game Flow

1. **Host creates a match**

   ```bash
   curl -X POST http://localhost:8080/api/match/create
   ```

2. **Players join the match**

   ```bash
   curl -X POST http://localhost:8080/api/match/match_abc123/join \
     -H "Content-Type: application/json" \
     -d '{"playerName": "Player1"}'
   ```

3. **Players connect via WebSocket**

   ```javascript
   const ws = new WebSocket("ws://localhost:8080/ws");

   ws.onopen = () => {
     ws.send(
       JSON.stringify({
         type: "player:connect",
         data: {
           matchId: "match_abc123",
           playerId: "player_xyz789",
         },
       })
     );
   };

   ws.onmessage = (event) => {
     const message = JSON.parse(event.data);
     console.log("Received:", message);
   };
   ```

4. **Host starts the match**

   ```bash
   curl -X POST http://localhost:8080/api/match/match_abc123/start
   ```

5. **Players shoot each other (TO BE IMPLEMENTED)**

   ```javascript
   ws.send(
     JSON.stringify({
       type: "shot:attempt",
       data: {
         matchId: "match_abc123",
         shooterId: "player_xyz789",
         targetQrData: "...",
         imageData: "base64_image...",
       },
     })
   );
   ```

6. **Check leaderboard anytime**

   ```bash
   curl http://localhost:8080/api/match/match_abc123/leaderboard
   ```

7. **End the match**
   ```bash
   curl -X POST http://localhost:8080/api/match/match_abc123/end
   ```

## Testing with Postman/Thunder Client

1. Import the above endpoints into your API client
2. Create a match and save the `matchId`
3. Join the match with multiple players
4. Use a WebSocket client to connect and test events
5. Start, play, and end the match

## Next Steps for Contributors

### Shot Processing Implementation

The `shot:attempt` event handler in `src/server/gameWebSocket.ts` needs to be implemented with:

1. Image validation/processing
2. AI-based hit detection
3. Score updates
4. Firebase logging

See `ARCHITECTURE.md` for detailed specifications.
