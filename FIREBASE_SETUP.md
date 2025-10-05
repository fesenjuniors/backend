# Firebase Setup Guide

## Quick Setup (5 minutes)

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name: `stormhacks-2025` (or your preferred name)
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Firestore Database

1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location (choose closest to you)
5. Click "Done"

### 3. Create Service Account

1. Go to Project Settings (gear icon) → "Service accounts"
2. Click "Generate new private key"
3. Download the JSON file
4. Rename it to `firebase-service-account.json` and place it in your project root

### 4. Update .env File

Replace the placeholder values in your `.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-actual-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

**OR** use the service account file:

```env
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

### 5. Test the Connection

```bash
npm run dev
```

You should see:

```
Firebase initialized successfully
```

## Database Structure

Your Firestore will have these collections:

### `matches` collection

- Document ID: `matchId`
- Fields: `id`, `adminId`, `state`, `createdAt`, `startedAt`, `endedAt`, `pausedAt`, `players[]`, `settings`

### `shots` collection

- Document ID: `shotId`
- Fields: `id`, `matchId`, `playerId`, `targetPlayerId`, `timestamp`, `imageUrl`, `isHit`, `points`, `processedAt`

## Security Rules (Optional)

For production, update your Firestore rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents (for development)
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Troubleshooting

### "Firebase not initialized" error

- Check your `.env` file has correct values
- Make sure `firebase-service-account.json` exists in project root
- Verify the service account has Firestore permissions

### "Permission denied" error

- Check your Firestore security rules
- Ensure service account has proper permissions

### Connection timeout

- Check your internet connection
- Verify Firebase project is active
- Try regenerating the service account key

## Free Tier Limits

- Firestore: 50,000 reads, 20,000 writes per day
- Perfect for hackathon development!
- Monitor usage in Firebase Console → Usage tab
