import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { glossaryViolations, httpsUrlError } from "./validate.mjs";
import {
  collectBriefingSchemaErrors,
  lintBriefing,
  sentenceCount,
  updatedAtError,
} from "./validate-briefing.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const briefing = JSON.parse(readFileSync(join(root, "briefing.json"), "utf8"));
const schema = JSON.parse(readFileSync(join(root, "schema", "briefing.schema.json"), "utf8"));
const pulseSchema = JSON.parse(readFileSync(join(root, "schema", "pulse.schema.json"), "utf8"));
const pulse = JSON.parse(readFileSync(join(root, "pulse.json"), "utf8"));
const pulseIds = new Set(pulse.map((item) => item.id));
const tags = pulseSchema.$defs.dailyPulseItem.properties.tag.enum;

const SLUGS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"];

function copy(overrides = {}) {
  return {
    headline: "Beispiel prüft den Feed",
    summary: "Beispiel ist eine kurze Meldung für den Feed.",
    ...overrides,
  };
}

function item(date, index, overrides = {}) {
  const slug = SLUGS[index];
  const base = {
    id: `${date}-${slug}`,
    headline: "Example checks the briefing feed",
    summary: "Example is a short briefing line for the feed.",
    source: { name: "Example News", url: `https://example.com/${date}/${slug}` },
    tag: "Tools",
    i18n: { de: copy() },
  };
  return {
    ...base,
    ...overrides,
    id: overrides.id ?? base.id,
    source: { ...base.source, ...overrides.source },
    i18n: overrides.i18n ?? base.i18n,
  };
}

function day(date, count = 6, overrides) {
  return {
    date,
    items: Array.from({ length: count }, (_, index) => item(date, index, overrides?.(index) ?? {})),
  };
}

function feed(options = {}) {
  const dates = options.dates ?? ["2026-10-08"];
  return {
    schemaVersion: options.schemaVersion ?? 1,
    updatedAt: options.updatedAt ?? "2026-10-08T04:45:00+02:00",
    days: options.days ?? dates.map((date) => day(date, options.count ?? 6)),
  };
}

function lint(briefingFeed, options = {}) {
  return lintBriefing(briefingFeed, { pulseIds, tags, ...options });
}

test("schema stays aligned with the pulse tag and priority enums", () => {
  assert.deepEqual(collectBriefingSchemaErrors(schema, pulseSchema), []);
  assert.equal(schema.$defs.item.additionalProperties, false);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.deepEqual(schema.$defs.item.properties.level.enum, ["beginner", "advanced"]);
  assert.equal(schema.$defs.item.required.includes("priority"), false);
  assert.equal(schema.$defs.item.required.includes("level"), false);
  assert.equal(schema.$defs.item.required.includes("pulseId"), false);

  const drifted = structuredClone(schema);
  drifted.$defs.item.properties.tag = { type: "string", enum: ["Other"] };
  assert.match(collectBriefingSchemaErrors(drifted, pulseSchema).join("\n"), /tag/);

  const pattern = new RegExp(schema.$defs.item.properties.source.properties.url.pattern);
  assert.equal(
    schema.$defs.item.properties.source.properties.url.pattern,
    pulseSchema.$defs.dailyPulseItem.properties.source.properties.url.pattern,
  );
  assert.match("https://example.com/a", pattern);
  assert.equal(pattern.test("http://example.com/a"), false);
});

test("updatedAt requires a numeric offset", () => {
  assert.equal(updatedAtError("2026-10-08T04:45:00+02:00"), null);
  assert.equal(updatedAtError("2026-10-08T04:45:00.000+02:00"), null);
  assert.equal(updatedAtError("2026-10-08T04:45:00-05:00"), null);
  assert.match(updatedAtError("2026-10-08T04:45:00Z"), /offset/);
  assert.match(updatedAtError("2026-10-08T04:45:00.000Z"), /offset/);
  assert.match(updatedAtError("2026-10-08T04:45:00"), /offset/);
  assert.match(updatedAtError("2026-02-31T04:45:00+02:00"), /calendar date/);
  assert.match(updatedAtError("2026-10-08T04:45:00+25:00"), /offset/);
});

test("sentenceCount ignores decimals and counts endings", () => {
  assert.equal(sentenceCount("One clear sentence."), 1);
  assert.equal(sentenceCount("One clear sentence. Another one follows."), 2);
  assert.equal(sentenceCount("One. Two. Three."), 3);
  assert.equal(sentenceCount("Haiku 5.5 costs $0.10 today."), 1);
  assert.equal(sentenceCount(""), 0);
});

test("a day accepts 6 to 8 items and rejects the counts outside that", () => {
  assert.deepEqual(lint(feed({ count: 6 })).errors, []);
  assert.deepEqual(lint(feed({ count: 8 })).errors, []);
  assert.match(lint(feed({ count: 5 })).errors.join("\n"), /6 to 8/);
  assert.match(lint(feed({ count: 9 })).errors.join("\n"), /6 to 8/);
});

test("days are newest first, unique, and capped at 7", () => {
  const dates = ["2026-10-08", "2026-10-07", "2026-10-06", "2026-10-05", "2026-10-04", "2026-10-03", "2026-10-02"];
  assert.deepEqual(lint(feed({ dates })).errors, []);
  assert.match(lint(feed({ dates: [...dates, "2026-10-01"] })).errors.join("\n"), /1 to 7/);
  assert.match(lint(feed({ days: [] })).errors.join("\n"), /1 to 7/);
  assert.match(lint(feed({ dates: ["2026-10-07", "2026-10-08"] })).errors.join("\n"), /newest first/);
  assert.match(lint(feed({ dates: ["2026-10-08", "2026-10-08"] })).errors.join("\n"), /duplicate date/);
  assert.match(lint(feed({ days: [day("2026-02-31")] })).errors.join("\n"), /real calendar date/);
});

test("ids are unique and the date prefix matches the day", () => {
  const reused = feed({
    days: [
      day("2026-10-08"),
      day("2026-10-07", 6, () => ({ id: "2026-10-07-alpha" })),
    ],
  });
  reused.days[1].items[1].id = "2026-10-08-alpha";
  assert.match(lint(reused).errors.join("\n"), /duplicate id 2026-10-08-alpha/);

  const shifted = feed();
  shifted.days[0].items[0].id = "2026-10-07-alpha";
  assert.match(lint(shifted).errors.join("\n"), /date prefix/);

  const badSlug = feed();
  badSlug.days[0].items[0].id = "2026-10-08-BadSlug";
  assert.match(lint(badSlug).errors.join("\n"), /YYYY-MM-DD-short-slug/);
});

test("priority, level, and pulseId follow the pulse contract", () => {
  const omitted = feed();
  assert.equal(Object.hasOwn(omitted.days[0].items[0], "priority"), false);
  assert.equal(Object.hasOwn(omitted.days[0].items[0], "pulseId"), false);
  assert.equal(Object.hasOwn(omitted.days[0].items[0], "level"), false);
  assert.deepEqual(lint(omitted).errors, []);

  for (const priority of ["normal", "breaking"]) {
    const result = lint(feed({ days: [day("2026-10-08", 6, () => ({ priority }))] }));
    assert.deepEqual(result.errors, [], priority);
  }
  for (const level of ["beginner", "advanced"]) {
    const result = lint(feed({ days: [day("2026-10-08", 6, () => ({ level }))] }));
    assert.deepEqual(result.errors, [], level);
  }

  const known = [...pulseIds][0];
  const linked = feed({ days: [day("2026-10-08", 6, () => ({ pulseId: known }))] });
  assert.deepEqual(lint(linked).errors, []);

  const missing = feed({ days: [day("2026-10-08", 6, () => ({ pulseId: "pulse-2026-10-08-missing" }))] });
  assert.match(lint(missing, { pulseIds: new Set() }).errors.join("\n"), /unknown id pulse-2026-10-08-missing/);

  for (const priority of ["urgent", "", null]) {
    const result = lint(feed({ days: [day("2026-10-08", 6, () => ({ priority }))] }));
    assert.match(result.errors.join("\n"), /priority/, String(priority));
  }
  const badLevel = lint(feed({ days: [day("2026-10-08", 6, () => ({ level: "expert" }))] }));
  assert.match(badLevel.errors.join("\n"), /level/);
});

test("english glossary terms are errors and German capitals are not", () => {
  const headline = feed();
  headline.days[0].items[0].headline = "The Agent ships in this headline today";
  assert.match(lint(headline).errors.join("\n"), /capitalised glossary term "Agent"/);

  const summary = feed();
  summary.days[0].items[0].summary = "Sol cut the Token price and the Reasoning effort.";
  const summaryErrors = lint(summary).errors.join("\n");
  assert.match(summaryErrors, /"Token"/);
  assert.match(summaryErrors, /"Reasoning"/);

  const german = feed();
  german.days[0].items[0].i18n = {
    de: copy({
      summary: "Der Agent bleibt im Token-Preis und beim Reasoning stehen.",
    }),
  };
  assert.deepEqual(lint(german).errors, []);
  assert.equal(glossaryViolations("Der Agent bleibt im Token-Preis.").length > 0, true);
});

test("lengths, sentences, https URLs, and extra fields are checked", () => {
  const longHeadline = feed();
  longHeadline.days[0].items[0].headline = "A".repeat(61);
  assert.match(lint(longHeadline).errors.join("\n"), /<= 60/);

  const longSummary = feed();
  longSummary.days[0].items[0].summary = `${"word ".repeat(50)}end.`;
  assert.match(lint(longSummary).errors.join("\n"), /<= 240/);

  const three = feed();
  three.days[0].items[0].summary = "One sentence here. Two sentences here. Three sentences here.";
  assert.match(lint(three).errors.join("\n"), /1 or 2 sentences/);

  const http = feed();
  http.days[0].items[0].source = { name: "Example News", url: "http://example.com/a" };
  assert.match(lint(http).errors.join("\n"), /https/);
  assert.match(httpsUrlError("http://example.com/a"), /https/);

  const extra = feed();
  extra.days[0].items[0].note = "nope";
  assert.match(lint(extra).errors.join("\n"), /unexpected field note/);

  const badVersion = feed({ schemaVersion: 2 });
  assert.match(lint(badVersion).errors.join("\n"), /schemaVersion/);

  const missingGerman = feed();
  missingGerman.days[0].items[0].i18n = {};
  assert.match(lint(missingGerman).errors.join("\n"), /German copy is required/);

  const badTag = feed();
  badTag.days[0].items[0].tag = "Not a tag";
  assert.match(lint(badTag).errors.join("\n"), /tag/);
});

test("live briefing.json passes", () => {
  const result = lintBriefing(briefing);
  assert.deepEqual(result.errors, []);
  assert.equal(briefing.schemaVersion, 1);
  assert.equal(briefing.updatedAt, "2026-10-08T04:45:00+02:00");
  assert.equal(briefing.days.length, 1);
  assert.equal(briefing.days[0].date, "2026-10-08");
  assert.equal(briefing.days[0].items.length, 6);
  for (const entry of briefing.days[0].items) {
    assert.equal(httpsUrlError(entry.source.url), null, entry.source.url);
    assert.equal(sentenceCount(entry.summary) >= 1 && sentenceCount(entry.summary) <= 2, true, entry.id);
    assert.deepEqual(glossaryViolations(entry.headline, { headline: true }), [], entry.id);
    assert.deepEqual(glossaryViolations(entry.summary), [], entry.id);
    if (entry.pulseId) assert.equal(pulseIds.has(entry.pulseId), true, entry.pulseId);
  }
});
