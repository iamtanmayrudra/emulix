import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AddDeviceButton, DeviceChooserDialog, MAX_OPEN_DEVICES, SecondDevice } from "../src/components/device-lab/second-device";
import { DEVICES } from "../src/lib/device-lab/devices";

const pixel = DEVICES.find((device) => device.id === "pixel-7")!;

describe("the plus button for a second device", () => {
  it("is enabled once the first device has a live page", () => {
    const markup = renderToStaticMarkup(<AddDeviceButton disabled={false} onClick={() => undefined} />);
    expect(markup).toContain('aria-label="Add a second device"');
    // The class names mention "disabled:" for styling, so look for the attribute itself.
    expect(markup).not.toContain('disabled=""');
  });

  it("is disabled, and says why, until the test has started", () => {
    const markup = renderToStaticMarkup(<AddDeviceButton disabled onClick={() => undefined} />);
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("start the test first");
  });

  it("allows two devices at most", () => {
    expect(MAX_OPEN_DEVICES).toBe(2);
  });
});

describe("the second device", () => {
  it("names the device, offers a close button, and shows a loading state while its browser opens", () => {
    const markup = renderToStaticMarkup(<SecondDevice device={pixel} session={null} onClose={() => undefined} />);
    expect(markup).toContain("Pixel 7");
    expect(markup).toContain('aria-label="Close Pixel 7"');
    expect(markup).toContain("Opening a browser on Pixel 7");
  });
});

describe("the device chooser", () => {
  it("lists the devices of a platform and offers every platform", () => {
    const markup = renderToStaticMarkup(<DeviceChooserDialog plan="pro" onChoose={() => undefined} onClose={() => undefined} />);
    expect(markup).toContain('aria-label="Choose a second device"');
    for (const label of ["iOS", "Android", "Desktop"]) expect(markup).toContain(label);
    expect(markup).toContain("iPhone 14");
  });
});
