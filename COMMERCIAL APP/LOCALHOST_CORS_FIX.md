# 🔧 Fix CORS Errors for Local Development

The CORS errors you're seeing are because Firebase Storage needs CORS configuration to allow requests from localhost.

## Quick Fix: Apply CORS Configuration

### Step 1: Install Google Cloud SDK

**Windows (PowerShell as Administrator):**
```powershell
# Option 1: Download installer from:
# https://cloud.google.com/sdk/docs/install

# Option 2: Using Chocolatey (if installed):
choco install gcloudsdk
```

**Mac:**
```bash
brew install --cask google-cloud-sdk
```

### Step 2: Authenticate

```bash
gcloud auth login
```

This opens a browser to sign in with your Google account (same one used for Firebase).

### Step 3: Set Your Project

```bash
gcloud config set project dc-estimate
```

### Step 4: Apply CORS Configuration

Navigate to the `COMMERCIAL APP` directory and run:

```bash
cd "C:\Users\Michael\Desktop\November2025\COMMERCIAL APP"
gsutil cors set cors.json gs://dc-estimate.firebasestorage.app
```

**Note:** If you get "bucket not found", check your exact bucket name:
- Go to Firebase Console → Storage → Files
- Look at the URL to find your bucket name
- It might be `dc-estimate.appspot.com` instead

### Step 5: Verify It Worked

```bash
gsutil cors get gs://dc-estimate.firebasestorage.app
```

You should see localhost ports in the output.

### Step 6: Restart Vite Dev Server

1. Stop the dev server (Ctrl+C)
2. Restart it: `npm run dev`
3. Hard refresh your browser (Ctrl+Shift+R)

## Alternative: Use Firebase Console (if available)

Some Firebase projects allow CORS configuration through the console:
1. Go to Firebase Console → Storage → Settings
2. Look for "CORS" or "Cross-Origin Resource Sharing" settings
3. Add localhost origins if available

## What This Does

The `cors.json` file now includes:
- ✅ Production domains (firebaseapp.com, web.app)
- ✅ Localhost ports (3000, 3001, 5173) for local development
- ✅ GET method only (read-only access)

After applying this, your local Vite dev server should be able to fetch PDFs from Firebase Storage without CORS errors!

