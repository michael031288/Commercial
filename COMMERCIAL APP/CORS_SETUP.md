# 🔧 Firebase Storage CORS Configuration

The CORS errors you're seeing are because Firebase Storage bucket needs CORS configuration to allow your web app to access PDF files.

**Important**: Firebase Console doesn't have a CORS configuration UI. You must use `gsutil` command-line tool.

## Security-First Configuration

This CORS configuration uses a **whitelist approach** - only your production Firebase hosting domains are allowed. This is more secure than allowing all origins (`"origin": ["*"]`) or including localhost.

## Step 1: Install Google Cloud SDK (if not already installed)

### Windows (PowerShell):
```powershell
# Download and install from: https://cloud.google.com/sdk/docs/install
# Or use Chocolatey:
choco install gcloudsdk
```

### Mac:
```bash
# Using Homebrew:
brew install --cask google-cloud-sdk
```

### Linux:
```bash
# Follow instructions at: https://cloud.google.com/sdk/docs/install
```

## Step 2: Authenticate with Google Cloud

Open PowerShell (or Terminal) and run:

```bash
gcloud auth login
```

This will open a browser window for you to sign in with your Google account (the same one used for Firebase).

## Step 3: Set Your Project

```bash
gcloud config set project dc-estimate
```

## Step 4: Apply CORS Configuration

Navigate to the `COMMERCIAL APP` directory and run:

```bash
cd "C:\Users\Michael\Desktop\November2025\COMMERCIAL APP"
gsutil cors set cors.json gs://dc-estimate.firebasestorage.app
```

**Important**: Your bucket name might be `dc-estimate.appspot.com` instead of `dc-estimate.firebasestorage.app`. 

To find your exact bucket name:
- Check Firebase Console → Storage → Files (look at the URL)
- Or check your `.env.local` file for `VITE_FIREBASE_STORAGE_BUCKET`
- Update the command with the correct bucket name if different

## Step 5: Verify CORS Configuration

```bash
gsutil cors get gs://dc-estimate.firebasestorage.app
```

You should see the CORS configuration printed, showing only your production domains.

## What This Secure CORS Configuration Does

The `cors.json` file allows **ONLY**:
- ✅ **Firebase hosting**: `https://dc-estimate.firebaseapp.com`
- ✅ **Custom domain**: `https://dc-estimate.web.app`
- ✅ **HTTP Method**: GET only (read-only access)
- ❌ **Localhost**: Excluded for security (production only)

## Security Benefits

This configuration is **highly secure** because:
- ✅ **Whitelist approach**: Only explicitly trusted domains are allowed
- ✅ **No wildcards**: Does NOT use `"origin": ["*"]` (which would allow any website)
- ✅ **Production only**: Localhost excluded to prevent development access in production
- ✅ **Read-only**: Only GET method allowed (no write operations via CORS)
- ✅ **Storage rules still apply**: Your Firebase Storage security rules still protect files (users can only access their own files)

## Why Exclude Localhost?

- **Security**: Prevents unauthorized local development access to production storage
- **Best practice**: Production CORS should only allow production domains
- **Attack surface reduction**: Fewer allowed origins = smaller attack surface

**Note**: If you need localhost for development, you can temporarily add it, but remove it before deploying to production.

## After Configuration

1. Wait 2-3 minutes for changes to propagate
2. Clear your browser cache or do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Test your PDF viewer on the production site - CORS errors should be gone!

## Troubleshooting

### If you get "bucket not found":
- Check your exact bucket name in Firebase Console → Storage → Files
- It might be `dc-estimate.appspot.com` instead of `dc-estimate.firebasestorage.app`
- Update the command: `gsutil cors set cors.json gs://YOUR-ACTUAL-BUCKET-NAME`

### If you get "permission denied":
- Make sure you're logged in: `gcloud auth login`
- Make sure you're using the account that owns the Firebase project
- Check your project: `gcloud config get-value project`

### If errors persist after configuration:
1. Verify CORS was applied: `gsutil cors get gs://dc-estimate.firebasestorage.app`
2. Check browser console for exact error messages
3. Make sure bucket name matches exactly
4. Wait a few more minutes for propagation
5. Try incognito/private browsing mode to bypass cache
6. Verify you're testing on the production domain (not localhost)

### For Local Development

If you need to test locally during development, you can temporarily add localhost to the CORS config:

```json
[
  {
    "origin": [
      "https://dc-estimate.firebaseapp.com",
      "https://dc-estimate.web.app",
      "http://localhost:5173"
    ],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
```

**Remember**: Remove localhost before deploying to production for maximum security.

