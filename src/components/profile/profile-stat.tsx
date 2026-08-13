export function ProfileStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-foreground text-lg font-semibold">
        {value.toLocaleString()}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
