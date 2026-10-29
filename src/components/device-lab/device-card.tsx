import type { Device } from "@/lib/device-lab/devices";
import { LockIcon, StarIcon } from "@/components/device-lab/icons";

type Props = {
  device: Device;
  selected: boolean;
  favorite: boolean;
  restricted: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
};

/** One row in the device list. Selection and favorite are separate buttons, so no interactive controls are nested. */
export function DeviceCard({ device, selected, favorite, restricted, onSelect, onToggleFavorite }: Props) {
  return (
    <div
      className={`flex items-center gap-2 rounded-[3px] px-2 py-1.5 text-sm transition-colors ${
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
        {restricted ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-pro">
            <LockIcon className="h-3.5 w-3.5" /> Pro
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted">{device.osVersion}</span>
        )}
      </button>
    </div>
  );
}
