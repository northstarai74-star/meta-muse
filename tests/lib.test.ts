import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { rateLimit } from "../src/lib/rate-limit";
import { safeEqual, verifySignature } from "../src/lib/meta";
import { heuristicClassify } from "../src/lib/ai/classify";

test("rateLimit blocks after the limit and recovers after the window", () => {
  const t = 1_000_000;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit("k", 3, 1000, t).ok, true);
  const blocked = rateLimit("k", 3, 1000, t + 10);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1);
  assert.equal(rateLimit("k", 3, 1000, t + 1001).ok, true);
});

test("verifySignature accepts a valid Meta HMAC and rejects tampering", () => {
  const body = '{"entry":[]}';
  const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
  assert.equal(verifySignature(body, sig, "s3cret"), true);
  assert.equal(verifySignature(body + " ", sig, "s3cret"), false);
  assert.equal(verifySignature(body, null, "s3cret"), false);
  assert.equal(verifySignature(body, "sha256=abc", "s3cret"), false);
});

test("safeEqual compares tokens in constant time without throwing on length mismatch", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual(null, "abc"), false);
});

test("heuristicClassify routes messages to the right service", () => {
  assert.equal(heuristicClassify("Can your AI receptionist answer missed calls? price?").service, "AI_VOICE");
  assert.equal(heuristicClassify("Need a new website and landing page, budget $2k").service, "WEB_DEV");
  assert.equal(heuristicClassify("Looking for a dropship supplier, bulk order").service, "DROPSHIPPING");
  assert.equal(heuristicClassify("hello there").service, "UNASSIGNED");
});

import { parseCsv, toCsv } from "../src/lib/csv";

test("toCsv quotes special characters and neutralises spreadsheet formulas", () => {
  const out = toCsv(["a", "b"], [["x,y", 'say "hi"'], ["=SUM(A1)", "line1\nline2"]]);
  assert.equal(out, 'a,b\r\n"x,y","say ""hi"""\r\n\'=SUM(A1),"line1\nline2"\r\n');
});

test("parseCsv handles quotes, embedded newlines, CRLF and a BOM", () => {
  const rows = parseCsv('﻿name,note\r\n"Ann, Jr.","a ""b""\nc"\r\nBob,\r\n\r\n');
  assert.deepEqual(rows, [["name", "note"], ["Ann, Jr.", 'a "b"\nc'], ["Bob", ""]]);
});

test("toCsv leaves phone numbers and negative numbers alone but still guards formulas", () => {
  const out = toCsv(["v"], [["+1 (555) 010-2030"], ["-5"], ["+cmd|x"], ["-2+3"], ["@SUM(1)"]]);
  assert.equal(out, "v\r\n+1 (555) 010-2030\r\n-5\r\n'+cmd|x\r\n'-2+3\r\n'@SUM(1)\r\n");
});
