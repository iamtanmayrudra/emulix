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
};

export function DeviceGrid({ devices, selectedId, favoriteIds, plan, onSelect, onToggleFavorite, emptyMessage }: Props) {
  if (devices.length === 0) {
    return (
      <p role="status" className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul aria-label="Devices" className="grid gap-x-3 gap-y-0.5 sm:grid-cols-2 md:grid-cols-3">
      {devices.map((device) => (
        <li key={device.id}>
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
