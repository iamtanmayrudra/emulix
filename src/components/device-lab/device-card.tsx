import type { Device } from "@/lib/device-lab/devices";
import { ChromeIcon, LockIcon, SafariIcon, StarIcon } from "@/components/device-lab/icons";

type Props = {
  device: Device;
  selected: boolean;
  favorite: boolean;
  restricted: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
};

/** Each side sits in the same grid cell. Motion is skipped for users who ask for reduced motion. */
const SWAP_BASE = "col-start-1 row-start-1 justify-self-end transition-all duration-300 ease-out motion-reduce:transition-none";
const SWAP_OUT = `${SWAP_BASE} group-hover:translate-x-4 group-hover:opacity-0 group-focus-within:translate-x-4 group-focus-within:opacity-0`;
const SWAP_IN = `${SWAP_BASE} translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100`;

/** Browsers a device opens with: Safari and Chrome on iPhone and iPad, Safari on Mac, Chrome elsewhere. */
export function browsersFor(device: Device): ("safari" | "chrome")[] {
  if (device.platform === "ios") return ["safari", "chrome"];
  if (device.osVersion.startsWith("Safari")) return ["safari"];
  return ["chrome"];
}

/**
 * One row in the device list. Selection and favorite are separate buttons, so no interactive controls are nested.
 * On hover or keyboard focus, the row swaps its OS version for the browsers the device opens with.
 */
export function DeviceCard({ device, selected, favorite, restricted, onSelect, onToggleFavorite }: Props) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-[3px] px-2 py-1.5 text-sm transition-colors ${
        selected ? "bg-accent/10 ring-1 ring-accent" : "hover:bg-background"
      } ${restricted ? "text-muted" : ""}`}
    >
      <button
        type="button"
        aria-pressed={favorite}
        aria-label={favorite ? `Remove ${device.name} from favorites` : `Add ${device.name} to favorites`}
        onClick={onToggleFavorite}
        className={`shrink-0 rounded-[3px] p-0.5 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent ${
          favorite ? "text-accent" : "text-muted"
        }`}
      >
        <StarIcon className="h-4 w-4" filled={favorite} />
      </button>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[3px] text-left focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="truncate font-medium">{device.name}</span>
        {/* Both sides share one grid cell, so the row keeps its width while the browsers slide in from the right. */}
        <span className="grid shrink-0 justify-items-end">
          {restricted ? (
            <span className={`${SWAP_OUT} flex items-center gap-1 text-xs font-semibold text-pro`}>
              <LockIcon className="h-3.5 w-3.5" /> Pro
            </span>
          ) : (
            <span className={`${SWAP_OUT} text-xs text-muted`}>{device.osVersion}</span>
          )}
          <span className={`${SWAP_IN} flex items-center gap-1.5`}>
            {browsersFor(device).map((browser) =>
              browser === "safari" ? (
                <SafariIcon key={browser} className="h-4 w-4" />
              ) : (
                <ChromeIcon key={browser} className="h-4 w-4" />
              ),
            )}
          </span>
        </span>
      </button>
    </div>
  );
}
