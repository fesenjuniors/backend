# QR Laser Tag - Backend Server

WebSocket-based game server for QR Laser Tag built with Node.js, Express, and TypeScript.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📡 Endpoints

### HTTP REST
- `GET /health` - Health check endpoint
  - Returns: `{ "status": "ok" }`

### WebSocket
- `ws://localhost:8080/ws` - Real-time game communication
  - Handles player connections, game events, and broadcasts

## 🔧 Configuration

Create a `.env` file in the root directory:

```env
PORT=8080
HOST=0.0.0.0
```

Defaults:
- Port: `8080`
- Host: `0.0.0.0`

## 📁 Project Structure

```
src/
├── config/          # Configuration and environment setup
│   └── environment.ts
├── routes/          # HTTP route handlers
│   └── index.ts
├── server/          # Server setup and WebSocket manager
│   ├── server.ts    # Main entry point
│   └── websocket.ts # WebSocket manager with typed events
└── types/           # TypeScript type definitions
    └── global.d.ts
```

## 🎮 Frontend Integration

### Connect to WebSocket

```javascript
const socket = new WebSocket('ws://localhost:8080/ws');

socket.addEventListener('open', () => {
    console.log('Connected!');
    
    // Send game events as JSON
    socket.send(JSON.stringify({
        type: 'player_join',
        playerId: 'player-123',
        name: 'Player1'
    }));
});

socket.addEventListener('message', (event) => {
    console.log('Received:', event.data);
});
```

## 🛠️ Development

The WebSocket manager exports typed events for easy extension:

- `connection` - Client connected (provides client count)
- `message` - Client sent a message (provides clientId, data, WebSocket)
- `disconnect` - Client disconnected (provides client count)

### Adding Game Events

Edit `src/server/server.ts` to handle custom game logic:

```typescript
websocketManager.on("message", (clientId, data, ws) => {
    const event = JSON.parse(data);
    
    switch(event.type) {
        case 'player_join':
            // Handle player joining
            break;
        case 'shoot':
            // Handle shooting events
            break;
        // Add more game events...
    }
});
```

## 📦 Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server

## 🤝 Team Development

- **Modular structure** for easy collaboration
- **TypeScript** for type safety across the team
- **Hot reload** for fast iteration during hackathon
- **Clean separation** between HTTP routes and WebSocket logic

Happy hacking! 🎯
