export function ProgressBar({
  percent,
  className = "",
  height = "h-2",
}: {
  percent: number;
  className?: string;
  height?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={`w-full ${height} rounded-full bg-surface-raised overflow-hidden ${className}`}
    >
      <div
        className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
