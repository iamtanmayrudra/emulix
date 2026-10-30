import { PLATFORM_LABELS, PLATFORM_ORDER, type DevicePlatform } from "@/lib/device-lab/devices";
import { AndroidIcon, AppleIcon, ClockIcon, DesktopIcon, StarIcon } from "@/components/device-lab/icons";

export type DeviceView = "favorites" | "recent" | DevicePlatform;

type Props = {
  view: DeviceView;
  onViewChange: (view: DeviceView) => void;
  favoriteCount: number;
  recentCount: number;
  totalCount: number;
  platformCounts: Record<DevicePlatform, number>;
  osVersions: string[];
  osVersion: string | null;
  onOsVersionChange: (osVersion: string | null) => void;
};

const PLATFORM_ICONS: Record<DevicePlatform, typeof AppleIcon> = {
  ios: AppleIcon,
  android: AndroidIcon,
  desktop: DesktopIcon,
};

/** Category list in the workspace sidebar. Favorites and Recent have no OS-version filter. */
export function DeviceSidebar({
  view,
  onViewChange,
  favoriteCount,
  recentCount,
  totalCount,
  platformCounts,
  osVersions,
  osVersion,
  onOsVersionChange,
}: Props) {
  const itemClass = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-[3px] px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
      active ? "bg-accent font-medium text-accent-foreground" : "hover:bg-background"
    }`;

  return (
    <nav aria-label="Device categories" className="space-y-0.5">
      <button
        type="button"
        aria-pressed={view === "favorites"}
        onClick={() => onViewChange("favorites")}
        className={itemClass(view === "favorites")}
      >
        <StarIcon className="h-5 w-5 shrink-0" filled={view !== "favorites"} />
        <span>
          Favorites <span className="font-semibold">({favoriteCount}/{totalCount})</span>
        </span>
      </button>
      <button
        type="button"
        aria-pressed={view === "recent"}
        onClick={() => onViewChange("recent")}
        className={itemClass(view === "recent")}
      >
        <ClockIcon className="h-5 w-5 shrink-0" />
        <span>Recent tests ({recentCount})</span>
      </button>

      {PLATFORM_ORDER.map((platform) => {
        const Icon = PLATFORM_ICONS[platform];
        const active = view === platform;
        return (
          <div key={platform}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onViewChange(platform)}
              className={itemClass(active)}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{PLATFORM_LABELS[platform]}</span>
              <span className="ml-auto text-xs opacity-75">{platformCounts[platform]}</span>
            </button>
            {active && osVersions.length > 1 && (
              <div role="group" aria-label="OS version" className="ml-10 mt-1 flex flex-col gap-0.5 pb-1">
                {[null, ...osVersions].map((version) => (
                  <button
                    key={version ?? "all"}
                    type="button"
                    aria-pressed={osVersion === version}
                    onClick={() => onOsVersionChange(version)}
                    className={`w-full rounded-[3px] px-2 py-1 text-left text-xs ${
                      osVersion === version ? "bg-accent/15 font-medium text-accent" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {version ?? "All"}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
