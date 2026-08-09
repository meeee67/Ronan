# PeakFlow Quest Tracker

An interactive, mobile-friendly tracker for the PeakFlow business blueprint — built with Next.js (App Router), TypeScript, and Tailwind CSS. All data is stored locally in the browser (`localStorage`); there is no backend.

## Features

- **Quest checklist** — 6 phases, collapsible, with per-phase and overall completion percentage.
- **Phase milestones** — completing every quest in a phase marks it `COMPLETE` with a confetti celebration and reveals the phase reward.
- **Daily schedule toggle** — switch between Summer and Winter schedules; the current time block is highlighted live.
- **Call tracker** — log cold calls (date, company, spoke to someone, demo given, outcome, follow-up date) with running totals and close rate.
- **Revenue dashboard** — add clients by tier (Receptionist $597 / Pro $1,497 / Growth $2,997), see MRR, client count, margin, and progress toward the $5k and $25k/month milestones.
- **Timers** — start/stop timers for the morning call block and evening build block, with daily totals and a session log.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```
