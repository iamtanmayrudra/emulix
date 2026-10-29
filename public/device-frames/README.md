# Device photos and frames

Put a photo or render of a device here and the app shows a live browser inside it. Devices without an image
use the drawn hardware, so you can add them one at a time.

## Only use images you have the right to use

Use your own photos, images you have bought or licensed, or open licences such as CC0 and CC-BY. Keep the licence
text next to the files, as `pommeplate/LICENSE-PommePlate-CC0.txt` does. An image being visible on a website, for
example Pinterest, does not mean you may reuse it in a product.

## Add an image

1. Save one image per device in the folder for its platform:

   | Folder | Devices |
   | --- | --- |
   | `ios/` | iPhones and iPads |
   | `android/` | Android phones and tablets |
   | `desktop/` | Laptops, desktops and Mac Safari |

2. Name the file with the device id from `src/lib/mock-data.ts`, for example `ios/iphone-16-pro.png`,
   `android/pixel-8.webp` or `desktop/laptop-1366.png`. PNG, WebP and JPG all work.
3. Run `npm run frames`. It finds the screen in each image and writes `src/lib/device-lab/frame-screens.json`.
4. Restart `npm run dev` so the new data is picked up. Then start a test on that device.

## Where the screen is

- **Transparent screen (best):** a PNG or WebP whose screen area is see-through is measured automatically. The
  live browser is drawn behind the image, so the notch, camera and bezel stay on top.
- **Opaque screen:** add `<device-id>.screen.json` beside the image with the screen's box in pixels of the
  original image. The live browser is drawn over the image.

  ```json
  { "x": 120, "y": 90, "width": 640, "height": 1380 }
  ```

  Add `"underlay": true` if the opening is transparent and you want to set the box yourself.

The script lists any file it could not use, and why, for example a name that is not a device id or an opaque
image with no `.screen.json`.

## Good images

- Straight-on, with the screen facing the camera, and no angle or reflection over the screen.
- A cut-out or transparent background, so the page behind shows through.
- Tall enough to stay sharp: about 1000 pixels on the long edge or more.
