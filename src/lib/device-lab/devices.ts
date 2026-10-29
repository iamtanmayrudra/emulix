import { DEVICE_PROFILES, type Plan } from "@/lib/mock-data";
import frameScreens from "./frame-screens.json";

/**
 * Device registry for the device lab UI.
 * Device ids match DEVICE_PROFILES, which the test-jobs API validates against.
 * OS versions and manufacturers are demo labels, not verified hardware or live availability.
 */

export type DevicePlatform = "ios" | "android" | "desktop";
export type DeviceCategory = "phone" | "tablet" | "desktop" | "laptop";

export type Device = {
  id: string;
  name: string;
  manufacturer: string;
  platform: DevicePlatform;
  osVersion: string;
  category: DeviceCategory;
  width: number;
  height: number;
  /** Lowest plan that may run tests on this device. */
  minPlan: Plan;
  /**
   * Device photo or render, served from public/device-frames. Set only when the screen opening is known, so a live
   * browser can be placed in it. Devices without one use the drawn hardware. See public/device-frames/README.md.
   */
  frameImage?: string;
  /**
   * Where the screen sits inside frameImage, as fractions of the image (x, y, width, height), and the
   * image's height divided by its width. Set only for frames whose screen was measured.
   */
  frameScreen?: FrameScreen;
};

export type FrameScreen = {
  x: number;
  y: number;
  width: number;
  height: number;
  aspect: number;
  /**
   * True when the frame image has a transparent screen opening. The screen is then drawn behind the image, so the
   * notch, camera and bezel stay on top. False or missing means the screen is drawn over the image.
   */
  underlay?: boolean;
};

/**
 * PommePlate templates (CC0). Each screen rectangle was estimated from the template's outline and the
 * device's published display size (about 12.7 px per mm for iPhone SE, 10.4 px per mm for iPad Air 4).
 * The templates have no marked screen, so these are estimates to check against a real render.
 */
const TEMPLATE_FRAMES: Record<string, { image: string; screen: FrameScreen }> = {
  "iphone-se": {
    image: "/device-frames/pommeplate/iphone-se-2nd-gen-black.png",
    screen: { x: 0.07004, y: 0.06803, width: 0.85991, height: 0.75141, aspect: 1764 / 866 },
  },
  "ipad-air": {
    image: "/device-frames/pommeplate/ipad-pro-11-ipad-air-4-silver.png",
    screen: { x: 0.0595, y: 0.0407, width: 0.8811, height: 0.9186, aspect: 2581 / 1861 },
  },
};

type DeviceMeta = Pick<Device, "manufacturer" | "platform" | "osVersion" | "category">;

const DEVICE_META: Record<string, DeviceMeta> = {
  "iphone-14": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "phone" },
  "iphone-se": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "phone" },
  "ipad-air": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "tablet" },
  "iphone-17-pro-max": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "phone" },
  "iphone-17-pro": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "phone" },
  "iphone-17": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "phone" },
  "iphone-air": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "phone" },
  "iphone-16-pro-max": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "phone" },
  "iphone-16-pro": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "phone" },
  "iphone-16-plus": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "phone" },
  "iphone-16": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "phone" },
  "ipad-pro-13": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "tablet" },
  "ipad-pro-11": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "tablet" },
  "ipad-air-13": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "tablet" },
  "ipad-11": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "tablet" },
  "ipad-mini": { manufacturer: "Apple", platform: "ios", osVersion: "26", category: "tablet" },
  "pixel-7": { manufacturer: "Google", platform: "android", osVersion: "Version TBD", category: "phone" },
  "galaxy-s23": { manufacturer: "Samsung", platform: "android", osVersion: "Version TBD", category: "phone" },
  "galaxy-tab-s9": { manufacturer: "Samsung", platform: "android", osVersion: "Version TBD", category: "tablet" },
  "pixel-8": { manufacturer: "Google", platform: "android", osVersion: "Version TBD", category: "phone" },
  "pixel-8-pro": { manufacturer: "Google", platform: "android", osVersion: "Version TBD", category: "phone" },
  "pixel-tablet": { manufacturer: "Google", platform: "android", osVersion: "Version TBD", category: "tablet" },
  "oneplus-12": { manufacturer: "OnePlus", platform: "android", osVersion: "Version TBD", category: "phone" },
  "galaxy-s24": { manufacturer: "Samsung", platform: "android", osVersion: "Version TBD", category: "phone" },
  "galaxy-s24-ultra": { manufacturer: "Samsung", platform: "android", osVersion: "Version TBD", category: "phone" },
  "galaxy-a54": { manufacturer: "Samsung", platform: "android", osVersion: "Version TBD", category: "phone" },
  "galaxy-tab-s8": { manufacturer: "Samsung", platform: "android", osVersion: "Version TBD", category: "tablet" },
  "xiaomi-14": { manufacturer: "Xiaomi", platform: "android", osVersion: "Version TBD", category: "phone" },
  "nothing-phone-2": { manufacturer: "Nothing", platform: "android", osVersion: "Version TBD", category: "phone" },
  "desktop-1280": { manufacturer: "Browser", platform: "desktop", osVersion: "Viewport", category: "desktop" },
  "laptop-1366": { manufacturer: "Browser", platform: "desktop", osVersion: "Viewport", category: "laptop" },
  "desktop-1440": { manufacturer: "Browser", platform: "desktop", osVersion: "Viewport", category: "desktop" },
  "mac-safari-26": { manufacturer: "Apple", platform: "desktop", osVersion: "Safari 26", category: "laptop" },
  "mac-safari-18": { manufacturer: "Apple", platform: "desktop", osVersion: "Safari 18", category: "laptop" },
  "mac-safari-17": { manufacturer: "Apple", platform: "desktop", osVersion: "Safari 17", category: "laptop" },
  "mac-safari-16": { manufacturer: "Apple", platform: "desktop", osVersion: "Safari 16", category: "laptop" },
  "mac-safari-15": { manufacturer: "Apple", platform: "desktop", osVersion: "Safari 15", category: "laptop" },
};

/** Frames added with `npm run frames` (public/device-frames), keyed by device id. */
const SUPPLIED_FRAMES = frameScreens as Record<string, { image: string; screen: FrameScreen }>;

/** Photo or render for a device, if one is mapped. Devices without one are drawn instead. */
function templateFrame(id: string): Pick<Device, "frameImage" | "frameScreen"> {
  const template = TEMPLATE_FRAMES[id];
  if (template) return { frameImage: template.image, frameScreen: template.screen };
  const supplied = SUPPLIED_FRAMES[id];
  if (supplied) return { frameImage: supplied.image, frameScreen: supplied.screen };
  return {};
}

export const DEVICES: Device[] = DEVICE_PROFILES.map((profile) => {
  const meta = DEVICE_META[profile.id];
  if (!meta) throw new Error(`Missing device metadata for profile "${profile.id}".`);
  return {
    id: profile.id,
    name: profile.name,
    width: profile.width,
    height: profile.height,
    minPlan: profile.minPlan,
    ...meta,
    ...templateFrame(profile.id),
  };
});

export const PLATFORM_LABELS: Record<DevicePlatform, string> = {
  ios: "iOS",
  android: "Android",
  desktop: "Desktop",
};

export const PLATFORM_ORDER: DevicePlatform[] = ["ios", "android", "desktop"];

/** iOS splits into iPhone (phone category) and iPad (tablet category). */
export const IOS_FAMILY_LABELS: Record<"phone" | "tablet", string> = {
  phone: "iPhone",
  tablet: "iPad",
};

export function findDevice(id: string): Device | undefined {
  return DEVICES.find((device) => device.id === id);
}

export function osVersionsFor(platform: DevicePlatform): string[] {
  const versions = DEVICES.filter((device) => device.platform === platform).map((device) => device.osVersion);
  return [...new Set(versions)];
}

export function deviceMatchesQuery(device: Device, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [device.name, device.manufacturer, PLATFORM_LABELS[device.platform], device.osVersion].some((field) =>
    field.toLowerCase().includes(needle),
  );
}
