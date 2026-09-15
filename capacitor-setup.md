# Capacitor Android Build Instructions

To convert your AgriFarm Management System into a native Android application (APK/AAB) using Capacitor, follow these steps in your local development environment:

## 1. Install Capacitor CLI & Core
Run these commands in your project root:
\`\`\`bash
npm install @capacitor/core
npm install -D @capacitor/cli @capacitor/android
\`\`\`

## 2. Initialize Capacitor
\`\`\`bash
npx cap init AgriFarm com.agrifarm.app --web-dir dist
\`\`\`

## 3. Add Android Platform
\`\`\`bash
npm run build
npx cap add android
\`\`\`

## 4. Sync Web Code to Android
Every time you make changes to your React app and run \`npm run build\`, sync the changes to the Android project:
\`\`\`bash
npx cap sync android
\`\`\`

## 5. Open in Android Studio
To compile the APK or run the app on an Android emulator/device:
\`\`\`bash
npx cap open android
\`\`\`

## Offline Storage
We have enabled Firestore IndexedDB offline persistence in \`src/lib/firebase.ts\`. Capacitor wraps the webview, meaning IndexedDB will automatically work natively on Android to store farm data while offline, and sync to Firebase when online.
