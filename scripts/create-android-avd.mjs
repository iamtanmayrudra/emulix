// Creates a small Android Virtual Device for APK testing, by copying the settings of one you already have.
//
//   npm run android:avd
//
// It copies the first AVD it finds (or the one named in ANDROID_SOURCE_AVD) to "Emulix_Phone" and changes only what keeps
// it light to stream: 2 GB of RAM and a 720 x 1600 screen. The system image is the same one, so nothing is downloaded.
//
// Needs an AVD made in Android Studio first (Device Manager > Create Device). It does not need the command-line tools.
// Note: the emulator insists on a 6 GB data partition for current system images, and refuses to start unless about 7.5 GB
// of disk is free. This script cannot change that.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const NAME = process.env.ANDROID_AVD_NAME || "Emulix_Phone";
const home = process.env.ANDROID_AVD_HOME || process.env.ANDROID_USER_HOME
  ? path.join(process.env.ANDROID_AVD_HOME || path.join(process.env.ANDROID_USER_HOME, "avd"))
  : path.join(homedir(), ".android", "avd");

if (!existsSync(home)) {
  console.error(`No AVD folder at ${home}. Create a device in Android Studio first (Device Manager > Create Device).`);
  process.exit(1);
}

const sources = readdirSync(home).filter((entry) => entry.endsWith(".ini") && entry !== `${NAME}.ini`);
const wanted = process.env.ANDROID_SOURCE_AVD;
const source = wanted ? sources.find((entry) => entry === `${wanted}.ini`) : sources[0];
if (!source) {
  console.error(wanted ? `No AVD named ${wanted} in ${home}.` : `No AVD found in ${home}. Create a device in Android Studio first.`);
  process.exit(1);
}

// The pointer file names the folder that holds the AVD's settings.
const pointer = readFileSync(path.join(home, source), "utf8");
const folderName = path.basename((pointer.match(/^path\.rel=(.*)$/m)?.[1] ?? pointer.match(/^path=(.*)$/m)?.[1] ?? "").trim().replace(/\\/g, "/"));
const sourceConfig = path.join(home, folderName, "config.ini");
if (!folderName || !existsSync(sourceConfig)) {
  console.error(`Could not read the settings of ${source}.`);
  process.exit(1);
}

const OVERRIDES = {
  AvdId: NAME,
  "avd.ini.displayname": "Emulix Phone",
  "hw.ramSize": "2048",
  "hw.lcd.width": "720",
  "hw.lcd.height": "1600",
  "hw.lcd.density": "320",
  "hw.keyboard": "yes",
};

const seen = new Set();
const lines = readFileSync(sourceConfig, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim() !== "")
  .map((line) => {
    const key = line.split("=")[0].trim();
    if (key in OVERRIDES) {
      seen.add(key);
      return `${key}=${OVERRIDES[key]}`;
    }
    return line;
  });
for (const [key, value] of Object.entries(OVERRIDES)) if (!seen.has(key)) lines.push(`${key}=${value}`);

const folder = path.join(home, `${NAME}.avd`);
mkdirSync(folder, { recursive: true });
writeFileSync(path.join(folder, "config.ini"), `${lines.join("\n")}\n`);

const target = pointer.match(/^target=(.*)$/m)?.[1]?.trim() ?? "android-36";
writeFileSync(
  path.join(home, `${NAME}.ini`),
  `avd.ini.encoding=UTF-8\npath=${folder}\npath.rel=avd/${NAME}.avd\ntarget=${target}\n`,
);

console.log(`Created the AVD "${NAME}" from ${source.replace(/\.ini$/, "")}.`);
console.log(`The emulator needs about 7.5 GB of free disk space to start. Then open APK testing in the app.`);
