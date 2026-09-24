#!/usr/bin/env node
/**
 * Clears the cached Apple ID password that EAS/fastlane store in macOS Keychain.
 * Service name format: deliver.<apple-id-email>
 */
const { execSync } = require('child_process');

const appleId = process.argv[2] || 'siddhantbudhia@gmail.com';
const service = `deliver.${appleId}`;

console.log(`Clearing Apple ID keychain entry for ${appleId}...`);

const attempts = [
  `security delete-internet-password -a "${appleId}" -s "${service}"`,
  `security delete-internet-password -a "${appleId}"`,
  `security delete-generic-password -a "${appleId}" -s "${service}"`,
];

let removed = false;
for (const cmd of attempts) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log(`Removed: ${cmd}`);
    removed = true;
  } catch {
    // entry may not exist for this variant
  }
}

if (!removed) {
  console.log('No matching Keychain entry found via CLI.');
  console.log('Open Keychain Access → search "deliver" or your Apple ID → delete manually.');
} else {
  console.log('Done. Re-run device registration and enter your password when prompted.');
}

console.log('\nTip: use EXPO_NO_KEYCHAIN=1 to skip Keychain on the next run:');
console.log('  EXPO_NO_KEYCHAIN=1 npm run device:ios');
