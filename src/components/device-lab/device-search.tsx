import type { Ref } from "react";
import { SearchIcon } from "@/components/device-lab/icons";

type Props = {
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
};

export function DeviceSearch({ value, onChange, inputRef }: Props) {
  return (
    <div className="relative">
      <label htmlFor="device-search" className="sr-only">
        Search devices
      </label>
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        id="device-search"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search devices"
        className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-8 text-sm focus-visible:outline-2 focus-visible:outline-accent"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[3px] px-1.5 text-base leading-none text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
        >
          ×
        </button>
      ) : (
        <kbd
          aria-hidden="true"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[3px] border border-border px-1.5 text-xs text-muted"
        >
          /
        </kbd>
      )}
    </div>
  );
}
