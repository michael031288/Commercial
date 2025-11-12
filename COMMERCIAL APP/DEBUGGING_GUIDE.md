# 🔍 Debugging Project Creation Issues

## Step 1: Check Browser Console

Open your browser's Developer Tools (F12) and check the Console tab. You should see detailed logs with emojis:

- 🚀 Starting project creation
- 📋 Generated project ID
- 📷 Uploading photo (if photo provided)
- 💾 Saving project to Firestore
- ✅ Project saved successfully
- 🔄 Reloading projects from Firestore
- 📋 Found projects: X

## Step 2: Check for Firebase Configuration Issues

Look for this error in the console:
```
⚠️ Firebase configuration is missing! Using placeholder values.
```

**If you see this**, your Firebase environment variables are not set up. You need to:

1. Create a `.env.local` file in the `COMMERCIAL APP` folder
2. Add your Firebase config:
```
VITE_FIREBASE_API_KEY=your-actual-api-key
VITE_FIREBASE_AUTH_DOMAIN=dc-estimate.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=dc-estimate
VITE_FIREBASE_STORAGE_BUCKET=dc-estimate.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

3. Get these values from: Firebase Console → Project Settings → General → Your apps → Web app config

4. **Important**: After creating `.env.local`, you need to rebuild and redeploy:
```powershell
cd "COMMERCIAL APP"
npm run build
npm run deploy
```

## Step 3: Check Firestore Rules

Make sure your Firestore rules allow authenticated users to create projects:

```javascript
match /projects/{projectId} {
  allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
  allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
}
```

These rules should already be deployed, but verify in Firebase Console → Firestore Database → Rules

## Step 4: Check Firestore Index

If you see this error:
```
⚠️ Firestore index missing! Create a composite index for:
   Collection: projects
   Fields: userId (Ascending), updatedAt (Descending)
```

**Fix it:**
1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Create Index"
3. Collection ID: `projects`
4. Fields to index:
   - `userId` (Ascending)
   - `updatedAt` (Descending)
5. Click "Create"

**OR** click the link in the error message - Firebase will create it for you automatically.

## Step 5: Check Authentication

Make sure you're logged in! Look for:
- ❌ Cannot create project: User not authenticated

If you see this, click the login button and sign in with Google.

## Step 6: Check Storage Rules

Make sure Storage rules allow uploads:

```javascript
match /{userId}/{projectId}/{allPaths=**} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && request.auth.uid == userId;
  allow delete: if request.auth != null && request.auth.uid == userId;
}
```

Verify in Firebase Console → Storage → Rules

## Step 7: Common Error Codes

- **permission-denied**: Check Firestore/Storage rules
- **failed-precondition**: Missing Firestore index (see Step 4)
- **unauthenticated**: User not logged in
- **invalid-argument**: Firebase config issue (see Step 2)

## Step 8: Verify Data in Firebase Console

1. **Firestore**: Go to Firebase Console → Firestore Database → Data
   - Look for a `projects` collection
   - Check if documents are being created

2. **Storage**: Go to Firebase Console → Storage → Files
   - Look for folders with your user ID
   - Check if images are being uploaded

## Still Not Working?

1. Copy ALL console errors and messages
2. Check the Network tab in DevTools for failed requests
3. Verify you're logged in (check Firebase Console → Authentication → Users)
4. Make sure you're testing on the deployed site: https://dc-estimate.web.app

