"use client";

import { SCHEDULES } from "@/lib/phases";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useClock } from "@/lib/useClock";
import { ScheduleType } from "@/lib/types";

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function ScheduleToggle() {
  const [schedule, setSchedule, hydrated] = useLocalStorage<ScheduleType>(
    "peakflow-schedule-v1",
    "summer"
  );
  const nowMs = useClock(30_000);
  const now = nowMs !== null ? new Date(nowMs) : null;

  if (!hydrated) {
    return <div className="text-sm text-muted">Loading schedule…</div>;
  }

  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : null;
  const blocks = SCHEDULES[schedule];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface p-3">
        <div className="flex items-center gap-1 rounded-lg bg-surface-raised p-1">
          {(["summer", "winter"] as ScheduleType[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSchedule(option)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                schedule === option
                  ? "bg-accent text-black"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {option === "summer" ? "☀️ Summer" : "❄️ Winter"}
            </button>
          ))}
        </div>
        {now && (
          <span className="font-mono text-sm text-accent">
            {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>

      <ol className="space-y-2">
        {blocks.map((block) => {
          const start = toMinutes(block.start);
          const end = toMinutes(block.end);
          const isCurrent =
            nowMinutes !== null && nowMinutes >= start && nowMinutes < end;
          return (
            <li
              key={block.label}
              className={`rounded-xl border p-3 transition-colors ${
                isCurrent
                  ? "animate-glow border-accent bg-accent-soft"
                  : "border-border-subtle bg-surface"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-sm font-medium ${
                    isCurrent ? "text-accent" : "text-foreground"
                  }`}
                >
                  {isCurrent && <span className="mr-1.5">▶</span>}
                  {block.label}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted">
                  {formatTime(block.start)} – {formatTime(block.end)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
