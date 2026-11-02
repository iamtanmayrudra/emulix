import { canSelectProfile } from "@/lib/entitlements";
import type { Device } from "@/lib/device-lab/devices";
import type { Plan } from "@/lib/mock-data";
import { DeviceCard } from "@/components/device-lab/device-card";

type Props = {
  devices: Device[];
  selectedId: string;
  favoriteIds: string[];
  plan: Plan;
  onSelect: (device: Device) => void;
  onToggleFavorite: (id: string) => void;
  emptyMessage: string;
  /** One item per row. Used for desktops, so each device reads as a single list entry. */
  singleColumn?: boolean;
};

/** Devices flow down each column and continue into the next one, as in the reference list. */
export function DeviceGrid({ devices, selectedId, favoriteIds, plan, onSelect, onToggleFavorite, emptyMessage, singleColumn = false }: Props) {
  if (devices.length === 0) {
    return (
      <p role="status" className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    // Column count follows the width of the list (not the window), so the list fits beside the category column.
    <ul
      aria-label="Devices"
      className={singleColumn ? "space-y-0.5" : undefined}
      style={singleColumn ? undefined : { columnWidth: "16rem", columnGap: "1.5rem" }}
    >
      {devices.map((device) => (
        <li key={device.id} className="break-inside-avoid pb-0.5">
          <DeviceCard
            device={device}
            selected={device.id === selectedId}
            favorite={favoriteIds.includes(device.id)}
            restricted={!canSelectProfile(plan, device)}
            onSelect={() => onSelect(device)}
            onToggleFavorite={() => onToggleFavorite(device.id)}
          />
        </li>
      ))}
    </ul>
  );
}
