import type { Ref } from "react";
import { GlobeIcon, PlusIcon, StarIcon } from "@/components/device-lab/icons";

type Props = {
  url: string;
  onUrlChange: (value: string) => void;
  urlError: string | null;
  starred: boolean;
  onToggleStar: () => void;
  inputRef: Ref<HTMLInputElement>;
};

/** Address bar for the target page. It only edits the URL; nothing opens remotely until a test starts. */
export function BrowserToolbar({ url, onUrlChange, urlError, starred, onToggleStar, inputRef }: Props) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
        <GlobeIcon className="h-5 w-5 shrink-0 text-muted" />
        <label htmlFor="target-url" className="sr-only">
          Website URL
        </label>
        <input
          ref={inputRef}
          id="target-url"
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          aria-invalid={urlError ? true : undefined}
          aria-describedby={urlError ? "url-error" : "url-help"}
          className="min-w-0 flex-1 bg-transparent text-sm focus-visible:outline-none"
        />
        <button
          type="button"
          aria-pressed={starred}
          aria-label={starred ? "Remove this address from favorites" : "Save this address as a favorite"}
          onClick={onToggleStar}
          className={`shrink-0 rounded-[3px] p-1 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent ${
            starred ? "text-accent" : "text-muted"
          }`}
        >
          <StarIcon className="h-4 w-4" filled={starred} />
        </button>
        <button
          type="button"
          disabled
          title="Browser extensions are not part of this prototype"
          className="hidden shrink-0 items-center gap-1 text-sm text-muted opacity-60 sm:flex"
        >
          <PlusIcon className="h-4 w-4" />
          Add extensions
        </button>
      </div>
      <p id="url-help" className="mt-1 text-xs text-muted">
        Public http or https addresses on standard ports. Local and private addresses are refused.
      </p>
      {urlError && (
        <p id="url-error" role="alert" className="mt-1 text-sm font-medium text-danger">
          {urlError}
        </p>
      )}
    </div>
  );
}
