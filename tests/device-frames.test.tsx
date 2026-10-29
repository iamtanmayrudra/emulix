import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DevicePicture } from "../src/components/device-lab/device-picture";
import { DEVICES, type Device, type FrameScreen } from "../src/lib/device-lab/devices";

const base = DEVICES.find((device) => device.id === "pixel-7")!;

/** A device with a made-up frame, so the test does not depend on which images are in public/device-frames. */
function withFrame(device: Device, screen: Partial<FrameScreen> = {}): Device {
  return { ...device, frameImage: "/device-frames/test.png", frameScreen: { x: 0.06, y: 0.04, width: 0.88, height: 0.92, aspect: 2.1, ...screen } };
}

function html(device: Device) {
  return renderToStaticMarkup(<DevicePicture device={device} screen="home" url="https://example.com/" onScreenChange={() => undefined} pageContent={<i id="live" />} />);
}

describe("device pictures with a supplied frame", () => {
  it("shows an Android screen, without the drawn camera, in an Android frame", () => {
    const markup = html(withFrame(base));
    expect(markup).toContain("Pixel 7 frame");
    expect(markup).toContain('id="live"');
    // The drawn punch-hole camera is skipped, because the photo has the real one.
    expect(markup).not.toContain("ring-neutral-800");
  });

  it("draws the screen behind a frame with a transparent opening, and lets clicks through the image", () => {
    const markup = html(withFrame(base, { underlay: true }));
    expect(markup.indexOf('id="live"')).toBeLessThan(markup.indexOf("<img"));
    expect(markup).toContain("pointer-events-none");
  });

  it("draws the screen over a frame with an opaque opening", () => {
    const markup = html(withFrame(base));
    expect(markup.indexOf("<img")).toBeLessThan(markup.indexOf('id="live"'));
    expect(markup).not.toContain("pointer-events-none");
  });

  it("shows a browser window in a desktop frame and the iOS screen in an iOS frame", () => {
    const laptop = html(withFrame(DEVICES.find((device) => device.id === "laptop-1366")!, { aspect: 0.625 }));
    expect(laptop).toContain("example.com");
    expect(laptop).toContain('aria-label="Address"');
    const iphone = html(withFrame(DEVICES.find((device) => device.id === "iphone-14")!));
    expect(iphone).toContain("iPhone 14 frame");
    expect(iphone).toContain("9:41");
  });

  it("keeps a landscape frame within the panel width", () => {
    const wide = html(withFrame(DEVICES.find((device) => device.id === "laptop-1366")!, { aspect: 0.5 }));
    const width = Number(/width:\s*([\d.]+)px;\s*height/.exec(wide)?.[1]);
    expect(width).toBeLessThanOrEqual(720 + 1);
  });

  it("falls back to the drawn device when there is no frame", () => {
    expect(html(base)).not.toContain("<img");
  });
});
