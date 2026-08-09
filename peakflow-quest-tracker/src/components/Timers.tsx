"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useClock } from "@/lib/useClock";
import { TimerBlock, TimerSession } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return `timer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  }
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

const BLOCKS: { id: TimerBlock; label: string; icon: string }[] = [
  { id: "morning_calls", label: "Morning call block", icon: "📞" },
  { id: "evening_build", label: "Evening build block", icon: "🛠️" },
];

type ActiveTimers = Partial<Record<TimerBlock, number>>;

function TimerCard({
  label,
  icon,
  activeStart,
  onStart,
  onStop,
  todaySeconds,
  now,
}: {
  label: string;
  icon: string;
  activeStart: number | undefined;
  onStart: () => void;
  onStop: () => void;
  todaySeconds: number;
  now: number;
}) {
  const running = activeStart !== undefined;
  const liveSeconds = running ? (now - activeStart) / 1000 : 0;
  const displayTotal = todaySeconds + liveSeconds;

  return (
    <div
      className={`rounded-xl border p-4 ${
        running ? "border-accent bg-accent-soft animate-glow" : "border-border-subtle bg-surface"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium text-sm">
          <span>{icon}</span>
          {label}
        </span>
        {running && (
          <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
        )}
      </div>

      <p className="mt-3 font-mono text-3xl font-bold tabular-nums">
        {formatDuration(running ? liveSeconds : todaySeconds)}
      </p>
      <p className="text-xs text-muted">
        {running ? "elapsed this session" : "today's total"}
      </p>

      {running && (
        <p className="mt-1 text-xs text-muted">
          Today so far: {formatDuration(displayTotal)}
        </p>
      )}

      <button
        type="button"
        onClick={running ? onStop : onStart}
        className={`mt-4 w-full rounded-lg py-2.5 text-sm font-semibold transition-colors ${
          running
            ? "bg-red-500/90 text-white active:bg-red-600"
            : "bg-accent text-black active:bg-accent-dim"
        }`}
      >
        {running ? "Stop" : "Start"}
      </button>
    </div>
  );
}

export function Timers() {
  const [sessions, setSessions, sessionsHydrated] = useLocalStorage<TimerSession[]>(
    "peakflow-timer-sessions-v1",
    []
  );
  const [active, setActive, activeHydrated] = useLocalStorage<ActiveTimers>(
    "peakflow-timer-active-v1",
    {}
  );
  const nowMs = useClock(1000);
  const now = nowMs ?? 0;

  const todayTotals = useMemo(() => {
    const today = todayISO();
    const totals: Record<TimerBlock, number> = { morning_calls: 0, evening_build: 0 };
    for (const s of sessions) {
      if (s.date === today) {
        totals[s.block] += s.seconds;
      }
    }
    return totals;
  }, [sessions]);

  if (!sessionsHydrated || !activeHydrated) {
    return <div className="text-sm text-muted">Loading timers…</div>;
  }

  const start = (block: TimerBlock) => {
    setActive((prev) => ({ ...prev, [block]: Date.now() }));
  };

  const stop = (block: TimerBlock) => {
    const startedAt = active[block];
    if (startedAt === undefined) return;
    const elapsedSeconds = Math.max(1, Math.round((now - startedAt) / 1000));
    const session: TimerSession = {
      id: uid(),
      block,
      date: todayISO(),
      seconds: elapsedSeconds,
    };
    setSessions((prev) => [session, ...prev]);
    setActive((prev) => {
      const next = { ...prev };
      delete next[block];
      return next;
    });
  };

  const combinedToday = todayTotals.morning_calls + todayTotals.evening_build;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border-subtle bg-surface p-4">
        <p className="text-xs uppercase tracking-wide text-muted">Combined today</p>
        <p className="mt-1 text-2xl font-bold text-accent">
          {formatDuration(
            combinedToday +
              Object.values(active).reduce(
                (sum: number, startedAt) =>
                  sum + (startedAt !== undefined ? (now - startedAt) / 1000 : 0),
                0
              )
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {BLOCKS.map((b) => (
          <TimerCard
            key={b.id}
            label={b.label}
            icon={b.icon}
            activeStart={active[b.id]}
            onStart={() => start(b.id)}
            onStop={() => stop(b.id)}
            todaySeconds={todayTotals[b.id]}
            now={now}
          />
        ))}
      </div>

      <div className="rounded-xl border border-border-subtle bg-surface p-4">
        <h3 className="font-semibold text-sm mb-2">Recent sessions</h3>
        {sessions.length === 0 && (
          <p className="text-sm text-muted py-2">No sessions logged yet.</p>
        )}
        <ul className="space-y-1.5">
          {sessions.slice(0, 10).map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between text-xs text-muted"
            >
              <span>
                {BLOCKS.find((b) => b.id === s.block)?.icon}{" "}
                {BLOCKS.find((b) => b.id === s.block)?.label} — {s.date}
              </span>
              <span className="font-mono">{formatDuration(s.seconds)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
