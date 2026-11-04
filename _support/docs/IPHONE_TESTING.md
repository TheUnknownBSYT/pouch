# Install and test Pouch on your iPhone

## Which build to use

| Build | Command | Use |
| --- | --- | --- |
| Development | `npm run build:ios` | Coding with live reload. Requires `npm run start:dev` on your computer. |
| Preview | `npm run build:ios:preview` | Everyday testing. Opens on its own, including from the share sheet. |
| Production | `npm run build:ios:production` | Upload to TestFlight, then eventually the App Store. |

**Start with Preview to try Pouch as a normal phone app.** All three include the native share extension. Development and Preview require the iPhone to be registered before building. They use the same bundle identifier, so installing one replaces the other.

The installed app is called **pouch**. Its linked EAS project still has the internal slug **buffer**:
[Expo project and builds](https://expo.dev/accounts/siddhant2612/projects/buffer/builds).
Keep `slug` aligned with that existing project; changing only `app.json` to `pouch` prevents EAS commands from running.

## 1. Finish Apple membership and device registration

Check that your paid membership shows as active at [Apple Developer](https://developer.apple.com/account/).

From the project directory:

```bash
npm run device:ios
```

1. Use the `siddhant2612` Expo account.
2. Enter the Apple ID associated with your paid membership, its password, and any verification code **in your terminal**.
3. Select your paid Apple team.
4. Choose **Website** registration.
5. Open the generated link in **Safari on the iPhone**.
6. Download the registration profile, then open **Settings → Profile Downloaded → Install**. If that entry is absent, look under **General → VPN & Device Management**.
7. Return to Safari and wait for the registration success message.
8. Check registration with `npm run device:list`.

Registering with Expo collects the device ID; EAS registers it with Apple when preparing the build. For a newly activated membership, Apple may require processing time before a newly registered device can enter a provisioning profile. If Apple reports that state, wait and retry the build.

## 2. Build a standalone copy

```bash
npm run check
npm run check:ios
npm run build:ios:preview
```

During signing setup:

- Sign in to the paid Apple team.
- Let EAS manage signing credentials and create missing distribution certificates/provisioning profiles.
- Select your registered iPhone for the ad hoc profile.
- Expect **two targets**: the main app and its share extension. Both need valid signing.

These identifiers are configured:

| Purpose | Identifier |
| --- | --- |
| App | `com.siddhant2612.pouch` |
| Share extension | `com.siddhant2612.pouch.share-extension` |
| Shared App Group | `group.com.siddhant2612.pouch` |

EAS uploads the current working files, so a GitHub push is not required before building. Generated `ios/` and `android/` folders are ignored; EAS regenerates them using the config plugins.

The selected EAS environment must contain `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. These public client settings have been configured for development, preview, and production. The build hook stops early if either is missing or a server-only key is accidentally supplied.

## 3. Install

When EAS reports **Finished**, open the build link on your iPhone and tap **Install** (or scan the build's installation QR code). Use the same device selected during signing.

For a development build, enable **Settings → Privacy & Security → Developer Mode**, restart, and confirm if prompted. If the option is missing, attempt the installation first and check again.

The Preview build opens directly and works without Metro or your computer. It still needs an internet connection to sign in, fetch items, and save to Supabase.

## 4. Test the capture flow

1. Open Pouch, sign in with your email code, force-close it, and reopen. Confirm you remain signed in.
2. Save a note, `buy milk tomorrow`, and `spent 120 on coffee via gpay`.
3. From Safari, share a webpage to **pouch - Share Extension**. If hidden, scroll the share sheet's app row to **More**, then enable/favorite it.
4. Repeat from Instagram and YouTube using their **Share → More** / system share-sheet action. Reels are saved as links, not downloaded videos.
5. Share plain text from another app where its system share menu supports it. WhatsApp's in-app **Forward** action is different from the iOS share sheet; copying and pasting into Pouch remains available.
6. Try a share with Pouch closed, then another with it open. Confirm one item per share and visible **Saved to Pouch** feedback.
7. Share the same content a second time intentionally; confirm it can be captured again.
8. Temporarily disable networking while sharing. Confirm the error and **Retry** button appear. Restore networking and retry before dismissing or replacing the pending share.
9. Complete a task from the inbox; edit its details; open a saved link; try Call/WhatsApp for a contact.
10. Open **Accounts**, choose the month, and export CSV to Files or another app.
11. Check keyboard send, the notch/home-indicator spacing, and light/dark mode.

Share capture currently supports **text and URLs**. A failed share stays in the native share state for retry; this is not a general offline queue. Avoid dismissing a failed share until it has saved. Notifications/reminders, downloaded media storage, widgets, and Sign in with Apple are separate product features, not automatic effects of developer membership.

## 5. Develop with live reload

```bash
npm run build:ios
# Install that development build once, then:
npm run start:dev
```

Keep the Mac and iPhone on the same Wi-Fi, allow local-network access if iOS asks, and open the development server from the installed Pouch app. If LAN discovery fails, `npm run start:dev -- --tunnel` can be used; Expo may ask to install its tunnel helper.

JavaScript/UI edits reload without rebuilding. Changing native packages, the share extension, entitlements, or native app configuration requires a new signed build.

The local Xcode installation checked during preparation was 16.2 and had a tooling load error. SDK 57 requires Xcode 26.4 or later. EAS cloud builds use their own compatible tooling, so local Xcode is not needed for the workflow above.

## 6. TestFlight later

After the first phone tests pass:

```bash
npm run build:ios:production
npm run submit:ios
```

Select the completed **production** build when submitting. EAS Submit uploads it to App Store Connect; it does not publish it publicly. Complete any Apple/App Store Connect setup prompted by EAS, then use the app's **TestFlight** tab to add yourself as an internal tester and install Apple's TestFlight app on the phone.

No ad hoc device list is needed for TestFlight. External testing can require Beta App Review. Public App Store release is a later step requiring store metadata, screenshots, privacy/support information, and review; account creation also brings an account-deletion requirement that needs implementation before public release.

## References

- [Expo: iOS device builds](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/)
- [Expo: internal distribution](https://docs.expo.dev/build/internal-distribution/)
- [Expo: app extension signing](https://docs.expo.dev/build-reference/app-extensions/)
- [Expo SDK 57 requirements](https://docs.expo.dev/versions/v57.0.0/)
- [Expo: submit to Apple](https://docs.expo.dev/submit/ios/)
- [Apple: TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
- [Apple: account deletion before public release](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion)
