"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const TOKENS_FILE = path.join(DATA_DIR, "tokens.json");

function genToken() {
  return crypto.randomBytes(24).toString("hex");
}

// Two roles, two separate secrets:
//  - laptopToken: goes ONLY on the machine running jarvis.py (jarvis-integration/relay_client.py).
//  - phoneTokens: one per device that's allowed to talk to Jarvis (phone, home page browser, ...).
//    A list so you can add a new device without invalidating the others.
function loadOrCreate() {
  try {
    const raw = fs.readFileSync(TOKENS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.laptopToken && Array.isArray(parsed.phoneTokens) && parsed.phoneTokens.length) {
      return parsed;
    }
  } catch (e) {
    // fall through to creation
  }
  const created = {
    laptopToken: process.env.LAPTOP_TOKEN || genToken(),
    phoneTokens: process.env.PHONE_TOKENS
      ? process.env.PHONE_TOKENS.split(",").map((t) => t.trim()).filter(Boolean)
      : [genToken()]
  };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(created, null, 2));
  return created;
}

const TOKENS = loadOrCreate();

function timingSafeEqualStr(a, b) {
  const aBuf = Buffer.from(String(a || ""));
  const bBuf = Buffer.from(String(b || ""));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isLaptopToken(token) {
  return timingSafeEqualStr(token, TOKENS.laptopToken);
}

function isPhoneToken(token) {
  return TOKENS.phoneTokens.some((t) => timingSafeEqualStr(token, t));
}

module.exports = { TOKENS, isLaptopToken, isPhoneToken, genToken, TOKENS_FILE };
