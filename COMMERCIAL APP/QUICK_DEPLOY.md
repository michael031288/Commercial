# 🚀 DEPLOY TO FIREBASE - QUICK GUIDE

## What You Need to Do (In Order):

### STEP 1: Create Firebase Project
1. Go to: https://console.firebase.google.com/
2. Click "Add project"
3. Name it "DC-ESTIMATE"
4. Create the project

### STEP 2: Enable Services
**Authentication:**
- Click "Authentication" → "Sign-in method" → Enable "Google"

**Firestore:**
- Click "Firestore Database" → "Create database" → Start in test mode

**Storage:**
- Click "Storage" → "Get started" → Start in test mode

### STEP 3: Get Your Config
1. Click the ⚙️ gear icon → "Project settings"
2. Scroll to "Your apps" → Click Web icon `</>`
3. Register app → Copy the config values

### STEP 4: Create .env.local File
Create a file named `.env.local` in the "COMMERCIAL APP" folder with:
```
VITE_FIREBASE_API_KEY=paste-your-api-key
VITE_FIREBASE_AUTH_DOMAIN=paste-your-auth-domain
VITE_FIREBASE_PROJECT_ID=paste-your-project-id
VITE_FIREBASE_STORAGE_BUCKET=paste-your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=paste-your-sender-id
VITE_FIREBASE_APP_ID=paste-your-app-id
```

### STEP 5: Update .firebaserc
Replace `your-project-id` with your actual Firebase project ID (Note: Project IDs are usually lowercase like "dc-estimate" even if the display name is "DC-ESTIMATE")

### STEP 6: Install & Login
```powershell
npm install -g firebase-tools
firebase login
```

### STEP 7: Deploy Rules
```powershell
cd "COMMERCIAL APP"
firebase deploy --only firestore:rules,storage:rules
```

### STEP 8: Test Locally
```powershell
npm run dev
```
Test login and create a project to make sure everything works!

### STEP 9: Deploy!
```powershell
npm run build
firebase deploy
```

**Your app will be live at:** `https://DC-ESTIMATE.web.app` (or `https://dc-estimate.web.app` if project ID is lowercase)

---

See `DEPLOY_CHECKLIST.md` for detailed step-by-step instructions!

