"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { AndroidDevice, AndroidScreen } from "@/components/device-lab/android-device";
import { DesktopDevice, DesktopScreen } from "@/components/device-lab/desktop-device";
import { IosDevice, IosScreen, type AppScreen } from "@/components/device-lab/ios-device";
import type { Device } from "@/lib/device-lab/devices";

export type { AppScreen };

export const SCREEN_LABELS: Record<AppScreen, string> = {
  home: "Home",
  chrome: "Chrome",
  safari: "Safari",
};

/** Largest edge of the on-screen viewport, in CSS pixels. */
const MAX_SCREEN_EDGE = 480;

/** Tallest a template frame may be on the page, so it fits the detail panel without scrolling. */
const MAX_FRAME_HEIGHT = 560;

/** Widest a template frame may be. Landscape frames, such as laptops, would otherwise be wider than the panel. */
const MAX_FRAME_WIDTH = 720;

/** Pixel size helper for inline styles. */
function px(value: number): string {
  return `${Math.round(value * 10) / 10}px`;
}

type Props = {
  device: Device;
  screen: AppScreen;
  url: string;
  onScreenChange: (screen: AppScreen) => void;
  /** Live browser session for this device, shown inside the browser. */
  pageContent?: ReactNode;
  /** Scale factor from the zoom control. 1 is the default size. */
  zoom?: number;
};

/**
 * The device picture. A licensed photo is used when one is supplied. Otherwise iOS devices are drawn as
 * real hardware with a home screen, and other devices get a generic frame with a browser window.
 */
export function DevicePicture({ device, screen, url, onScreenChange, pageContent, zoom = 1 }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const edge = MAX_SCREEN_EDGE * zoom;
  const scale = Math.min(1, edge / device.width, edge / device.height);
  const screenWidth = Math.round(device.width * scale);
  const screenHeight = Math.round(device.height * scale);
  // A photo is used only when its screen opening is known, so a live browser can sit in it.
  const photo = device.frameImage && device.frameScreen && failedSrc !== device.frameImage ? device.frameImage : null;

  let picture;
  if (photo && device.frameScreen) {
    // The screen is placed in the frame's measured opening. A frame with a transparent opening has the screen drawn
    // behind it, so the notch, camera and bezel stay on top. Otherwise the screen is drawn over the image.
    const fs = device.frameScreen;
    const underlay = fs.underlay === true;
    const frameHeight = Math.min(MAX_FRAME_HEIGHT, MAX_FRAME_WIDTH * fs.aspect) * zoom;
    const frameWidth = frameHeight / fs.aspect;
    const holeWidth = frameWidth * fs.width;
    const holeHeight = frameHeight * fs.height;

    const image = (
      <Image
        src={photo}
        alt={`${device.name} frame`}
        width={Math.round(frameWidth)}
        height={Math.round(frameHeight)}
        unoptimized
        onError={() => setFailedSrc(photo)}
        className={`absolute inset-0 h-full w-full ${underlay ? "pointer-events-none" : ""}`}
      />
    );
    const hole = (
      <div
        className="absolute overflow-hidden rounded-[2%]"
        style={{
          left: px(fs.x * frameWidth),
          top: px(fs.y * frameHeight),
          width: px(holeWidth),
          height: px(holeHeight),
        }}
      >
        {device.platform === "ios" ? (
          <IosScreen
            width={holeWidth}
            height={holeHeight}
            isTablet={device.category === "tablet"}
            screen={screen}
            url={url}
            onScreenChange={onScreenChange}
            pageContent={pageContent}
          />
        ) : device.platform === "android" ? (
          <AndroidScreen
            category={device.category === "tablet" ? "tablet" : "phone"}
            width={holeWidth}
            height={holeHeight}
            url={url}
            pageContent={pageContent}
            showCamera={false}
          />
        ) : (
          <DesktopScreen width={holeWidth} height={holeHeight} url={url} pageContent={pageContent} />
        )}
      </div>
    );

    picture = (
      <div className="relative" style={{ width: px(frameWidth), height: px(frameHeight) }}>
        {underlay ? (
          <>
            {hole}
            {image}
          </>
        ) : (
          <>
            {image}
            {hole}
          </>
        )}
      </div>
    );
  } else if (device.platform === "ios") {
    picture = (
      <IosDevice
        category={device.category}
        width={screenWidth}
        height={screenHeight}
        screen={screen}
        url={url}
        onScreenChange={onScreenChange}
        pageContent={pageContent}
      />
    );
  } else if (device.platform === "android") {
    picture = (
      <AndroidDevice
        category={device.category === "tablet" ? "tablet" : "phone"}
        width={screenWidth}
        height={screenHeight}
        url={url}
        pageContent={pageContent}
      />
    );
  } else {
    picture = (
      <DesktopDevice
        category={device.category === "laptop" ? "laptop" : "desktop"}
        width={screenWidth}
        height={screenHeight}
        url={url}
        pageContent={pageContent}
      />
    );
  }

  return (
    <figure className="flex flex-col items-center gap-3">
      {picture}
      <figcaption className="text-xs text-muted">
        {device.name} · {device.width} × {device.height}
      </figcaption>
    </figure>
  );
}
