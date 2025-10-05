# Game End Events - Complete Flow

## When Does Game End?

- **Trigger**: When any player's cumulative score (from shots + garbage collection) reaches or exceeds **250 points**
- **Check Location**: After every score update in `matchManager.updatePlayerScore()`

## Events Sent (in order):

### 1. `game:ended` Event

**Sent to**: ALL players in the match
**Purpose**: Announce that the game has ended and who won

```json
{
  "type": "game:ended",
  "data": {
    "matchId": "match_xxx",
    "winner": {
      "id": "player_xxx",
      "name": "PlayerName",
      "score": 570
    },
    "message": "🎉 PlayerName won the game with 570 points!"
  }
}
```

### 2. `player:won` Event

**Sent to**: The WINNING player only
**Purpose**: Personal victory notification

```json
{
  "type": "player:won",
  "data": {
    "matchId": "match_xxx",
    "playerId": "player_xxx",
    "playerName": "PlayerName",
    "finalScore": 570,
    "message": "🏆 Congratulations! You won the game with 570 points!"
  }
}
```

### 3. `player:lost` Event(s)

**Sent to**: ALL OTHER players (not the winner)
**Purpose**: Personal defeat notification with comparison to winner

```json
{
  "type": "player:lost",
  "data": {
    "matchId": "match_xxx",
    "playerId": "player_yyy",
    "playerName": "OtherPlayer",
    "finalScore": 350,
    "winnerName": "PlayerName",
    "winnerScore": 570,
    "message": "😔 Game over! PlayerName won with 570 points. You scored 350 points."
  }
}
```

## Score Accumulation

- **QR Code Shots**: Points added via `broadcastResult()` → `updatePlayerScore()`
- **Garbage Collection**: Points added via garbage detection → `updatePlayerScore()`
- **Total Score**: Cumulative sum of all points from both sources

## Debug Logs to Watch For

### When score reaches threshold:

```
🔍 Score check: 270 >= 250? true
🎉 Player player_xxx (PlayerName) has reached the score threshold of 250! Current score: 270
🏁 Match end result: true, Match state is now: ended
🏆 Game Over! Winner: PlayerName (570 points)
```

### When broadcasting events:

```
🔍 Checking game end for match match_xxx, state: ended
🎯 Match match_xxx has ended, broadcasting win events...
📡 Broadcasting game:ended event: {...}
📡 Broadcasting individual win/lose events to 3 players...
📡 Broadcasting player:won to PlayerName: {...}
📡 Broadcasting player:lost to Player2: {...}
📡 Broadcasting player:lost to Player3: {...}
✅ All game end events broadcasted! Winner: PlayerName (570 points)
📊 Events sent: game:ended (all), player:won (winner), player:lost (2 losers)
```

## Frontend Implementation

### Handle game:ended

```javascript
case 'game:ended':
  // Show game over screen
  // Display winner announcement
  // Show final leaderboard
  // Disable further game actions
  break;
```

### Handle player:won

```javascript
case 'player:won':
  // Show victory screen
  // Play celebration animation
  // Display achievements
  break;
```

### Handle player:lost

```javascript
case 'player:lost':
  // Show defeat screen
  // Display final score
  // Show winner info
  // Display "Try again" option
  break;
```

## Testing Checklist

- [ ] Player reaches 250+ points from QR shots only
- [ ] Player reaches 250+ points from garbage collection only
- [ ] Player reaches 250+ points from combination of both
- [ ] All 3 events are received by frontend
- [ ] Winner receives `game:ended` + `player:won`
- [ ] Losers receive `game:ended` + `player:lost`
- [ ] Match state changes to "ended"
- [ ] No further score updates allowed after game ends
