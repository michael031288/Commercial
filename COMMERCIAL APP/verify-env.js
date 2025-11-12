# Quick verification script - run this to check your .env.local file
# Run: node verify-env.js

import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(process.cwd(), '.env.local');

console.log('🔍 Checking .env.local file...\n');

try {
  const envContent = readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  const requiredVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];
  
  console.log('Found variables:');
  const foundVars = new Set();
  
  lines.forEach(line => {
    const [key] = line.split('=');
    if (key) {
      const trimmedKey = key.trim();
      foundVars.add(trimmedKey);
      const isRequired = requiredVars.includes(trimmedKey);
      const hasValue = line.includes('=') && line.split('=')[1]?.trim();
      const status = isRequired ? (hasValue ? '✅' : '❌ Missing value') : '⚠️  Not required';
      console.log(`  ${status} ${trimmedKey}`);
    }
  });
  
  console.log('\nRequired variables check:');
  let allPresent = true;
  requiredVars.forEach(varName => {
    if (foundVars.has(varName)) {
      console.log(`  ✅ ${varName}`);
    } else {
      console.log(`  ❌ ${varName} - MISSING!`);
      allPresent = false;
    }
  });
  
  if (allPresent) {
    console.log('\n✅ All required variables are present!');
    console.log('Now run: npm run build && npm run deploy');
  } else {
    console.log('\n❌ Some variables are missing. Please add them to .env.local');
  }
  
} catch (error: any) {
  if (error.code === 'ENOENT') {
    console.log('❌ .env.local file not found!');
    console.log(`   Expected location: ${envPath}`);
    console.log('\n   Please create .env.local file with your Firebase config.');
  } else {
    console.log('❌ Error reading file:', error.message);
  }
}

