// Fail before native compilation if a cloud build would ship without its backend settings.
const assert = require('node:assert/strict');
const { expo } = require('../../app.json');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert(url, 'Set EXPO_PUBLIC_SUPABASE_URL in the selected EAS build environment.');
assert(key, 'Set EXPO_PUBLIC_SUPABASE_ANON_KEY in the selected EAS build environment.');
assert(new URL(url).protocol === 'https:', 'Supabase URL must use HTTPS.');
if (!key.startsWith('sb_publishable_')) {
  let role;
  try {
    role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role;
  } catch {
    throw new Error('Use a Supabase publishable key or legacy anon key for the client.');
  }
  assert(role === 'anon', 'The app must use an anon/publishable key, never a service-role key.');
}

const bundle = expo.ios.bundleIdentifier;
assert(bundle && !bundle.includes('undefined'), 'Configure a valid iOS bundle identifier.');
const extensions = expo.extra.eas.build.experimental.ios.appExtensions;
assert(extensions.length === 1, 'Expected exactly one share extension.');
assert(extensions[0].bundleIdentifier === `${bundle}.share-extension`, 'Share extension bundle ID must match the app.');
assert.deepEqual(
  extensions[0].entitlements['com.apple.security.application-groups'],
  [`group.${bundle}`],
  'App and share extension must use the same App Group.',
);
console.log('iOS build configuration and public Supabase settings are valid.');
