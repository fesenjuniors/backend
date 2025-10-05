# Google Cloud Vision API Setup (5 minutes)

## Quick Setup for Hackathon:

### 1. Enable Vision API
```bash
# Visit: https://console.cloud.google.com/apis/library/vision.googleapis.com
# Click "Enable API"
```

### 2. Create Service Account
```bash
# Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
# Click "Create Service Account"
# Name: "qr-scanner-dev"
# Click "Create and Continue"
# Role: "Cloud Vision AI Service Agent"
# Click "Done"
```

### 3. Download Key
```bash
# Click on your new service account
# Go to "Keys" tab → "Add Key" → "Create New Key"
# Choose JSON → Download
# Save as: google-credentials.json in project root
```

### 4. Set Environment Variable
```bash
# Option A: Export (temporary)
export GOOGLE_APPLICATION_CREDENTIALS="/home/kian/backend/google-credentials.json"

# Option B: Add to .env file (permanent)
echo 'GOOGLE_APPLICATION_CREDENTIALS=/home/kian/backend/google-credentials.json' >> .env
```

### 5. Load credentials in code
Add to `src/config/environment.ts`:
```typescript
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}
```

### 6. Test it!
```bash
npx ts-node test-vision.ts /home/kian/backend/src/test-pictures/IMG_6025.jpg
```

## Free Tier
- 1,000 requests/month FREE
- Perfect for hackathon testing!
- After: $1.50 per 1,000 images

## Troubleshooting
If you get credential errors:
```bash
# Check if file exists
ls -la google-credentials.json

# Verify environment variable
echo $GOOGLE_APPLICATION_CREDENTIALS

# Re-export
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/google-credentials.json"
```
