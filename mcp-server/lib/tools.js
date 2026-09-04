"use strict";

const { z } = require("zod");
const store = require("./store");

const MIN_SESSION_SEC = 30;

function json(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(message) {
  return { content: [{ type: "text", text: JSON.stringify({ error: message }) }], isError: true };
}

function registerTools(server) {
  server.registerTool(
    "get_state",
    {
      title: "Get raw tracker state",
      description:
        "Returns the full tracker state: categories, the currently running timer (if any), and every logged session, call, and income record."
    },
    async () => json(store.getState())
  );

  server.registerTool(
    "get_totals",
    {
      title: "Get totals for a day",
      description:
        "Returns revenue-facing percentage, total/revenue minutes, per-category minutes, call count, and income total for a given local day (defaults to today). Also includes the trailing 7-day revenue percentage.",
      inputSchema: {
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Local date as YYYY-MM-DD. Defaults to today.")
      }
    },
    async ({ date }) => {
      const key = date || store.todayKey();
      const totals = store.totalsFor(key);
      const rolling7DayRevenuePct = store.rolling7DayPct(key);
      return json({ ...totals, rolling7DayRevenuePct });
    }
  );

  server.registerTool(
    "get_history",
    {
      title: "Get a day's log",
      description:
        "Returns every session, call, and income record for a given local day, merged and sorted reverse-chronologically (defaults to today).",
      inputSchema: {
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Local date as YYYY-MM-DD. Defaults to today.")
      }
    },
    async ({ date }) => json(store.historyForDay(date || store.todayKey()))
  );

  // ---------- Categories ----------
  server.registerTool(
    "list_categories",
    { title: "List categories", description: "Lists all categories in display order." },
    async () => json(store.sortedCategories())
  );

  server.registerTool(
    "add_category",
    {
      title: "Add a category",
      description: "Creates a new category and appends it to the end of the display order.",
      inputSchema: {
        name: z.string().min(1),
        revenue: z.boolean().default(false).describe("Whether time in this category counts toward the revenue-facing percentage.")
      }
    },
    async ({ name, revenue }) => {
      const cat = store.mutate((state) => {
        const maxOrder = state.categories.reduce((m, c) => Math.max(m, c.order), -1);
        const created = { id: store.uid(), name, revenue: !!revenue, order: maxOrder + 1 };
        state.categories.push(created);
        return created;
      });
      return json(cat);
    }
  );

  server.registerTool(
    "update_category",
    {
      title: "Rename or retag a category",
      description: "Updates a category's name and/or revenue flag.",
      inputSchema: {
        id: z.string(),
        name: z.string().min(1).optional(),
        revenue: z.boolean().optional()
      }
    },
    async ({ id, name, revenue }) => {
      const result = store.mutate((state) => {
        const target = state.categories.find((c) => c.id === id);
        if (!target) return null;
        if (name !== undefined) target.name = name;
        if (revenue !== undefined) target.revenue = revenue;
        return target;
      });
      return result ? json(result) : err("No category with that id.");
    }
  );

  server.registerTool(
    "delete_category",
    {
      title: "Delete a category",
      description:
        "Deletes a category. Refuses if it is the last remaining category. If it has sessions attached (or is currently running), you must pass cascade: true to also delete those sessions, mirroring the app's confirmation step.",
      inputSchema: {
        id: z.string(),
        cascade: z.boolean().default(false).describe("Required to be true if the category has sessions attached.")
      }
    },
    async ({ id, cascade }) => {
      const state = store.getState();
      if (state.categories.length <= 1) return err("Cannot delete the last remaining category.");
      const hasSessions =
        state.sessions.some((s) => s.catId === id) || (state.running && state.running.catId === id);
      if (hasSessions && !cascade) {
        return err("This category has logged sessions. Retry with cascade: true to delete it and its sessions.");
      }
      const existed = state.categories.some((c) => c.id === id);
      if (!existed) return err("No category with that id.");
      store.mutate((st) => {
        if (st.running && st.running.catId === id) st.running = null;
        st.sessions = st.sessions.filter((s) => s.catId !== id);
        st.categories = st.categories.filter((c) => c.id !== id);
      });
      return json({ deleted: id, cascaded: hasSessions });
    }
  );

  // ---------- Timers ----------
  server.registerTool(
    "start_timer",
    {
      title: "Start a category's timer",
      description:
        "Starts the timer for a category, recording the current timestamp as the start. If another timer is already running, it is stopped and saved first (sessions under 30 seconds are discarded), matching the app's one-timer-at-a-time rule.",
      inputSchema: { categoryId: z.string() }
    },
    async ({ categoryId }) => {
      const cat = store.categoryById(categoryId);
      if (!cat) return err("No category with that id.");
      const result = store.mutate((state) => {
        if (state.running) stopRunningInternal(state);
        state.running = { catId: categoryId, startedAt: Date.now() };
        return state.running;
      });
      return json(result);
    }
  );

  server.registerTool(
    "stop_timer",
    {
      title: "Stop the running timer",
      description:
        "Stops whichever timer is currently running and saves it as a session. Sessions under 30 seconds are discarded rather than saved."
    },
    async () => {
      const state = store.getState();
      if (!state.running) return err("No timer is currently running.");
      const saved = store.mutate((st) => stopRunningInternal(st));
      return json(saved || { discarded: true, reason: "under 30 seconds" });
    }
  );

  // ---------- Sessions ----------
  server.registerTool(
    "log_session",
    {
      title: "Log a completed time block",
      description: "Quick-add: logs a completed session without using the live timer.",
      inputSchema: {
        categoryId: z.string(),
        minutes: z.number().positive(),
        note: z.string().optional(),
        startTs: z.number().int().optional().describe("Epoch milliseconds. Defaults to now.")
      }
    },
    async ({ categoryId, minutes, note, startTs }) => {
      const cat = store.categoryById(categoryId);
      if (!cat) return err("No category with that id.");
      const session = store.mutate((state) => {
        const created = {
          id: store.uid(),
          catId: categoryId,
          start: startTs || Date.now(),
          minutes,
          note: note || ""
        };
        state.sessions.push(created);
        return created;
      });
      return json(session);
    }
  );

  server.registerTool(
    "edit_session",
    {
      title: "Edit a logged session",
      description: "Edits a session's category, start time, minutes, and/or note.",
      inputSchema: {
        id: z.string(),
        categoryId: z.string().optional(),
        minutes: z.number().positive().optional(),
        note: z.string().optional(),
        startTs: z.number().int().optional()
      }
    },
    async ({ id, categoryId, minutes, note, startTs }) => {
      const result = store.mutate((state) => {
        const target = state.sessions.find((s) => s.id === id);
        if (!target) return null;
        if (categoryId !== undefined) target.catId = categoryId;
        if (minutes !== undefined) target.minutes = minutes;
        if (note !== undefined) target.note = note;
        if (startTs !== undefined) target.start = startTs;
        return target;
      });
      return result ? json(result) : err("No session with that id.");
    }
  );

  server.registerTool(
    "delete_session",
    {
      title: "Delete a logged session",
      inputSchema: { id: z.string() }
    },
    async ({ id }) => {
      const existed = store.getState().sessions.some((s) => s.id === id);
      if (!existed) return err("No session with that id.");
      store.mutate((state) => {
        state.sessions = state.sessions.filter((s) => s.id !== id);
      });
      return json({ deleted: id });
    }
  );

  // ---------- Calls ----------
  server.registerTool(
    "log_call",
    {
      title: "Log a call",
      description: "Records a +1 call event.",
      inputSchema: {
        note: z.string().optional(),
        ts: z.number().int().optional().describe("Epoch milliseconds. Defaults to now.")
      }
    },
    async ({ note, ts }) => {
      const call = store.mutate((state) => {
        const created = { id: store.uid(), ts: ts || Date.now(), note: note || "" };
        state.calls.push(created);
        return created;
      });
      return json(call);
    }
  );

  server.registerTool(
    "edit_call",
    {
      title: "Edit a call record",
      inputSchema: {
        id: z.string(),
        note: z.string().optional(),
        ts: z.number().int().optional()
      }
    },
    async ({ id, note, ts }) => {
      const result = store.mutate((state) => {
        const target = state.calls.find((c) => c.id === id);
        if (!target) return null;
        if (note !== undefined) target.note = note;
        if (ts !== undefined) target.ts = ts;
        return target;
      });
      return result ? json(result) : err("No call with that id.");
    }
  );

  server.registerTool(
    "delete_call",
    { title: "Delete a call record", inputSchema: { id: z.string() } },
    async ({ id }) => {
      const existed = store.getState().calls.some((c) => c.id === id);
      if (!existed) return err("No call with that id.");
      store.mutate((state) => {
        state.calls = state.calls.filter((c) => c.id !== id);
      });
      return json({ deleted: id });
    }
  );

  // ---------- Income ----------
  server.registerTool(
    "log_income",
    {
      title: "Log income",
      description: "Records an income entry. Any amount, any precision — stored exactly as given, no rounding.",
      inputSchema: {
        amount: z.number(),
        note: z.string().optional(),
        ts: z.number().int().optional().describe("Epoch milliseconds. Defaults to now.")
      }
    },
    async ({ amount, note, ts }) => {
      const income = store.mutate((state) => {
        const created = { id: store.uid(), ts: ts || Date.now(), amount, note: note || "" };
        state.income.push(created);
        return created;
      });
      return json(income);
    }
  );

  server.registerTool(
    "edit_income",
    {
      title: "Edit an income record",
      inputSchema: {
        id: z.string(),
        amount: z.number().optional(),
        note: z.string().optional(),
        ts: z.number().int().optional()
      }
    },
    async ({ id, amount, note, ts }) => {
      const result = store.mutate((state) => {
        const target = state.income.find((i) => i.id === id);
        if (!target) return null;
        if (amount !== undefined) target.amount = amount;
        if (note !== undefined) target.note = note;
        if (ts !== undefined) target.ts = ts;
        return target;
      });
      return result ? json(result) : err("No income record with that id.");
    }
  );

  server.registerTool(
    "delete_income",
    { title: "Delete an income record", inputSchema: { id: z.string() } },
    async ({ id }) => {
      const existed = store.getState().income.some((i) => i.id === id);
      if (!existed) return err("No income record with that id.");
      store.mutate((state) => {
        state.income = state.income.filter((i) => i.id !== id);
      });
      return json({ deleted: id });
    }
  );

  server.registerTool(
    "get_all_time_income",
    { title: "Get all-time income total" },
    async () => json({ allTimeIncome: store.allTimeIncome() })
  );
}

function stopRunningInternal(state) {
  if (!state.running) return null;
  const start = state.running.startedAt;
  const end = Date.now();
  const minutes = (end - start) / 60000;
  let saved = null;
  if ((end - start) / 1000 >= MIN_SESSION_SEC) {
    saved = { id: store.uid(), catId: state.running.catId, start, minutes, note: "" };
    state.sessions.push(saved);
  }
  state.running = null;
  return saved;
}

module.exports = { registerTools };
