# 🔧 Fix Firebase Environment Variables

## The Problem

Your `.env.local` file exists, but the production build isn't reading it. This happens because:

1. **Environment variables must have `VITE_` prefix** - Vite only exposes variables that start with `VITE_`
2. **The `.env.local` file must be in the `COMMERCIAL APP` folder** (same folder as `package.json`)
3. **You must rebuild after changing `.env.local`** - The values are baked into the build at build time

## Step 1: Verify Your .env.local File

Make sure your `.env.local` file is in the `COMMERCIAL APP` folder and has this exact format:

```env
VITE_FIREBASE_API_KEY=AIzaSy...your-actual-key
VITE_FIREBASE_AUTH_DOMAIN=dc-estimate.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=dc-estimate
VITE_FIREBASE_STORAGE_BUCKET=dc-estimate.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_GEMINI_API_KEY=your-gemini-key
```

**Important Notes:**
- ✅ Each variable MUST start with `VITE_`
- ✅ No spaces around the `=` sign
- ✅ No quotes around the values (unless the value itself contains spaces)
- ✅ File must be named exactly `.env.local` (with the dot at the start)

## Step 2: Verify Variables Are Being Read

After updating `.env.local`, test locally:

```powershell
cd "COMMERCIAL APP"
npm run dev
```

Open the browser console and look for:
```
🔧 Firebase Config Check:
  API Key: AIzaSy...
  Auth Domain: dc-estimate.firebaseapp.com
  Project ID: dc-estimate
  ...
✅ Firebase initialized successfully
```

If you see "MISSING" or "your-api-key", the variables aren't being read.

## Step 3: Rebuild and Redeploy

Once you verify the variables are correct locally:

```powershell
cd "COMMERCIAL APP"
npm run build
npm run deploy
```

## Step 4: Verify Production Build

After deploying, check the deployed site's console. You should see:
- ✅ Firebase initialized successfully
- No warnings about placeholder values

## Common Issues

### Issue: Variables not being read
**Solution:** Make sure:
- File is named `.env.local` (not `.env` or `env.local`)
- File is in `COMMERCIAL APP` folder (same as `package.json`)
- All variables start with `VITE_`
- You rebuilt after changing the file

### Issue: Still seeing "your-api-key" in production
**Solution:** The build didn't include your env vars. Make sure:
1. `.env.local` exists before running `npm run build`
2. Variables have `VITE_` prefix
3. You're running `npm run build` from the `COMMERCIAL APP` folder

### Issue: Works locally but not in production
**Solution:** This is normal! `.env.local` is only used during build. Make sure you:
1. Have `.env.local` with correct values
2. Run `npm run build` (this reads `.env.local` and bakes values into the build)
3. Run `npm run deploy` (this uploads the built files)

## Quick Test

Run this to verify your env vars are being read:

```powershell
cd "COMMERCIAL APP"
npm run build
# Check the build output - it should complete without errors
# Then check dist/index.html or dist/assets/*.js - search for your project ID
# You should see "dc-estimate" (or your actual project ID) in the built files
```

