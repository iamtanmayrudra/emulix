# APK testing

Upload an Android app and use it on a real Android emulator, from the **APK testing** page. The app is installed on a
temporary emulator that is thrown away when the session ends.

## How it works

```text
upload  ->  check the file  ->  start an emulator  ->  install and open the app  ->  live screen
(page)      (aapt2)             (Android SDK)         (adb)                         (screenshots + taps)
```

| Step | What happens |
| --- | --- |
| Upload | The file must end in `.apk`, be a zip, fit the plan's size limit, and be readable as an app by `aapt2`. It is stored under a random name and deleted when the session ends or fails |
| Start | An emulator starts in the background from a clean copy (read-only), so nothing is kept and several can run at once. The page shows progress |
| Install | `adb install`. An app built for Android 6 or older is retried with the switch Android 14 and newer needs for old apps |
| Use | The page shows the phone's screen as pictures (about 5 a second). A click is a tap, a drag is a swipe, holding is a long press, the mouse wheel scrolls, and typing enters text. Back, Home and Recent apps are buttons under the phone |
| End | Stop, Cancel, closing the page, or 5 minutes without use. Every session ends after 20 minutes |

## What the server needs

| Need | Detail |
| --- | --- |
| Android SDK | Android Studio, or the command-line tools. The app looks in `ANDROID_HOME`, then `ANDROID_SDK_ROOT`, then the usual place. It needs `platform-tools` (adb), `emulator`, and `build-tools` (aapt2) |
| An Android device | At least one AVD (Android Studio > Device Manager). The page lists the AVDs it finds. `npm run android:avd` makes a lighter copy called "Emulix Phone" |
| Acceleration | Windows Hypervisor Platform, Hyper-V, or KVM. Without it the emulator is far too slow |
| Disk | **About 7.5 GB free.** Current system images make the emulator reserve a 6 GB data partition and refuse to start with less |
| Memory | About 2.5 GB per running emulator |

If any of this is missing the page says so, in words, instead of failing.

## Where it cannot run

Netlify, Vercel and other serverless hosts cannot run an emulator. There the APK page says it is not available. A container
host cannot either unless it offers hardware virtualization (KVM), which most do not. Use your own machine, a bare-metal
server, or a cloud VM with nested virtualization.

## Limits and settings

| Setting | Meaning |
| --- | --- |
| Free plan | 1 phone at a time, 2 APK tests a month, 50 MB per APK |
| Pro plan | 2 phones at a time, 50 APK tests a month, 300 MB per APK |
| `ANDROID_MAX_SESSIONS` | The most phones the whole server runs at once (default 2) |
| `ANDROID_EMULATOR=off` | Switch the feature off. `on` forces it on even where the host looks serverless |
| `ANDROID_HOME` | Where the SDK is |

A test that could not start does not use up one of the month's tests.

## What does not work yet

- Rotating the phone, throttling the network, and installing from the Play Store.
- Typing characters outside plain ASCII, or `%`, `\`, `'` and `` ` ``. They are skipped, because the phone's text tool cannot enter them safely.
- Apps that only include ARM code. The emulator is an Intel one, and the page says so if the app will not install.
- Session history is kept in the server's memory, like website sessions, and is lost when the server restarts.

## Safety

An uploaded app runs inside an emulator with network access. Treat it as untrusted: run this on a machine you are happy to
expose an emulator on, never on one that holds secrets the emulator could reach. Package and screen names read from the app are
checked against strict patterns before they go in any command, and typed text is reduced to plain characters.

## Testing it

`tests/android.test.ts` covers reading APKs, the commands sent to the phone, finding the SDK, and the whole session
lifecycle against a stand-in phone. `tests/android-live.test.ts` starts a real emulator and a real APK. It is skipped unless you
ask for it (see the comment at the top of that file), because it needs the SDK, 7.5 GB of disk and a few minutes.
