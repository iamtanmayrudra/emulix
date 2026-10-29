type Props = {
  label: string;
  used: number;
  limit: number;
};

export function UsageMeter({ label, used, limit }: Props) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor =
    percent >= 100 ? "bg-danger" : percent >= 80 ? "bg-warning" : "bg-accent";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted">
          {used} of {limit} used
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border"
      >
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
