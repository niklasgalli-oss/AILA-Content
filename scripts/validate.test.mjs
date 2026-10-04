import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalSourceUrl,
  collectSchemaErrors,
  explainsSubject,
  glossaryViolations,
  httpsUrlError,
  lintFeed,
  lowercaseGlossaryTerms,
  usesHeadlineCasing,
} from "./validate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pulse = JSON.parse(readFileSync(join(root, "pulse.json"), "utf8"));
const schema = JSON.parse(readFileSync(join(root, "schema", "pulse.schema.json"), "utf8"));

function deepDive(body = "A short section.") {
  return [
    "## The Hook",
    "",
    body,
    "",
    "## The Core Mechanism",
    "",
    body,
    "",
    "## The Trade-off",
    "",
    body,
    "",
    "## Practical Takeaway",
    "",
    body,
    "",
  ].join("\n");
}

function copy(overrides = {}) {
  return {
    headline: "Beispiel prüft den Feed",
    hook: "Beispiel ist ein Werkzeug für den Feed.",
    summaryPoints: ["Eins ist die Quelle.", "Zwei nennt die Grenze.", "Drei sagt den nächsten Schritt."],
    takeaway: "Starte den Check vor dem Push.",
    deepDiveMarkdown: deepDive("Kurzer Abschnitt mit dem Agent und einem Token."),
    ...overrides,
  };
}

function item(overrides = {}) {
  const base = {
    id: "pulse-2026-10-01-example",
    date: "2026-10-01T00:00:00.000Z",
    tag: "Framework",
    readTimeMinutes: 4,
    listenTimeMinutes: 6,
    hook: "Example is a tool that checks a story before it ships.",
    headline: "Example checks the feed",
    summaryPoints: [
      "Example is a validator for the pulse feed.",
      "It does not fetch the network unless asked.",
      "Run it before you push.",
    ],
    takeaway: "Run the validator before you push.",
    deepDiveMarkdown: deepDive(),
    source: { name: "Example News", url: "https://example.com/story" },
    i18n: { de: copy() },
  };
  return {
    ...base,
    ...overrides,
    source: { ...base.source, ...overrides.source },
    i18n: overrides.i18n ?? base.i18n,
  };
}

const NOW = Date.parse("2026-10-04T12:00:00.000Z");

test("schema still matches the validator contract", () => {
  assert.deepEqual(collectSchemaErrors(schema), []);
});

test("live source URLs are https and match the schema pattern", () => {
  const pattern = new RegExp(schema.$defs.dailyPulseItem.properties.source.properties.url.pattern);
  for (const entry of pulse) {
    assert.equal(httpsUrlError(entry.source.url), null, entry.source.url);
    assert.match(entry.source.url, pattern);
  }
});

test("flags glossary terms capitalised mid-sentence", () => {
  const headline = glossaryViolations("Claude Code mods let you reprogram the Agent loop", { headline: true });
  assert.deepEqual(headline.map((hit) => hit.term), ["Agent"]);
  assert.equal(headline[0].expected, "agent");

  const weights = glossaryViolations("Aleph Alpha ships Kolibri as German Open Weights", { headline: true });
  assert.deepEqual(weights.map((hit) => hit.term), ["Open Weights"]);
  assert.equal(weights[0].expected, "open weights");

  const price = glossaryViolations("Sol cut the Token price and the Reasoning effort.");
  assert.deepEqual(price.map((hit) => [hit.term, hit.expected]), [
    ["Token", "token"],
    ["Reasoning", "reasoning"],
  ]);

  assert.equal(glossaryViolations("The lab skipped FINE-TUNING on this run.")[0].expected, "fine-tuning");
  assert.equal(glossaryViolations("Raise the Context window before you retry.")[0].expected, "context window");
});

test("allows sentence starts, title case, and product names", () => {
  assert.deepEqual(glossaryViolations("Tokens got cheaper. Agents kept the log."), []);
  assert.deepEqual(glossaryViolations("Context window size is the first limit."), []);
  assert.equal(usesHeadlineCasing("How Agents Spend Tokens During Inference"), true);
  assert.deepEqual(
    glossaryViolations("How Agents Spend Tokens During Inference", { headline: true }),
    [],
  );
  assert.equal(usesHeadlineCasing("Claude Code mods let you reprogram the Agent loop"), false);
  for (const name of [
    "Open Agent Safety Platform",
    "Microsoft Agent 365",
    "Claude Managed Agents",
    "Agent Toolkit",
  ]) {
    assert.deepEqual(glossaryViolations(`The release pairs ${name} with a local runtime.`), [], name);
  }
});

test("lowercaseGlossaryTerms keeps product names and sentence starts", () => {
  const input = "Agents, Inference, Fine-Tuning, and a Token. The Open Agent Safety Platform stays. A Benchmark too.";
  const output = lowercaseGlossaryTerms(input);
  assert.match(output, /^Agents, inference, fine-tuning, and a token\./);
  assert.match(output, /Open Agent Safety Platform/);
  assert.match(output, /A benchmark too\./);
});

test("beginner sentence is a warning, not an error", async () => {
  assert.equal(explainsSubject("Dots are named, always-on agents."), true);
  assert.equal(explainsSubject("Kolibri, a 78B English-German model, shipped."), true);
  assert.equal(explainsSubject("Claude Code now runs mods, small functions that rewrite prompts."), true);
  assert.equal(explainsSubject("OpenAI shipped Sol at a lower price."), false);

  const defined = await lintFeed([item()], { now: NOW });
  assert.deepEqual(defined.errors, []);
  assert.deepEqual(defined.warnings, []);

  const vague = await lintFeed(
    [
      item({
        hook: "OpenAI shipped Sol at a lower price after internal tests.",
        summaryPoints: [
          "OpenAI says Sol approaches Astra on coding and computer use.",
          "Those figures are the company's own comparisons.",
          "Compare one real task before you trust the price.",
        ],
      }),
    ],
    { now: NOW },
  );
  assert.deepEqual(vague.errors, []);
  assert.equal(vague.warnings.length, 1);
  assert.match(vague.warnings[0], /beginner sentence/);
});

test("duplicate ids and source URLs are errors", async () => {
  const first = item({ id: "pulse-2026-10-01-one", source: { url: "https://example.com/same/" } });
  const second = item({
    id: "pulse-2026-10-01-two",
    headline: "A second headline for the same source",
    source: { url: "https://EXAMPLE.com/same" },
  });
  const result = await lintFeed([first, second], { now: NOW });
  assert.match(result.errors.join("\n"), /duplicate of pulse-2026-10-01-one/);
  assert.equal(canonicalSourceUrl("https://EXAMPLE.com/same/"), canonicalSourceUrl("https://example.com/same"));

  const reusedId = await lintFeed(
    [item({ id: "pulse-2026-10-01-one" }), item({ id: "pulse-2026-10-01-one", source: { url: "https://example.com/other" } })],
    { now: NOW },
  );
  assert.match(reusedId.errors.join("\n"), /duplicate id pulse-2026-10-01-one/);
});

test("future dates, bad durations, and malformed URLs are errors", async () => {
  const future = await lintFeed(
    [item({ date: "2026-10-05T00:00:00.000Z", id: "pulse-2026-10-05-later" })],
    { now: NOW },
  );
  assert.match(future.errors.join("\n"), /must not be in the future/);

  for (const readTimeMinutes of [0, -1, 1.5, 31, "4"]) {
    const result = await lintFeed([item({ readTimeMinutes })], { now: NOW });
    assert.match(result.errors.join("\n"), /positive whole number of minutes/, String(readTimeMinutes));
  }

  assert.equal(httpsUrlError("https://example.com/a"), null);
  assert.match(httpsUrlError("http://example.com/a"), /https/);
  assert.match(httpsUrlError("https://"), /well-formed/);
  assert.match(httpsUrlError("https://localhost/a"), /host name/);
  assert.match(httpsUrlError("https://user:pass@example.com/a"), /credentials/);

  const badUrl = await lintFeed([item({ source: { url: "http://example.com/a" } })], { now: NOW });
  assert.match(badUrl.errors.join("\n"), /https/);
});

test("German capitalised glossary terms are not errors", async () => {
  const result = await lintFeed(
    [
      item({
        i18n: {
          de: copy({
            hook: "Der Agent bleibt im Token-Preis und im Benchmark stehen.",
            takeaway: "Prüfe den Context Window und das Fine-Tuning.",
          }),
        },
      }),
    ],
    { now: NOW },
  );
  assert.deepEqual(result.errors, []);
});

test("--check-urls requires HTTP 200 and can be injected", async () => {
  const ok = await lintFeed([item()], { now: NOW, checkUrls: true, fetchUrl: async () => 200 });
  assert.deepEqual(ok.errors, []);

  const missing = await lintFeed([item()], { now: NOW, checkUrls: true, fetchUrl: async () => 404 });
  assert.match(missing.errors.join("\n"), /expected HTTP 200, got HTTP 404/);

  const skipped = await lintFeed([item()], { now: NOW, checkUrls: false, fetchUrl: async () => 500 });
  assert.deepEqual(skipped.errors, []);
});

test("live pulse.json passes, with beginner warnings only", async () => {
  const result = await lintFeed(pulse, { now: Date.now() });
  assert.deepEqual(result.errors, []);
  for (const warning of result.warnings) assert.match(warning, /beginner sentence/);
  for (const entry of pulse) {
    for (const field of ["headline", "hook", "takeaway"]) {
      assert.deepEqual(
        glossaryViolations(entry[field], { headline: field === "headline" }),
        [],
        `${entry.id} ${field}`,
      );
    }
    for (const [index, point] of entry.summaryPoints.entries()) {
      assert.deepEqual(glossaryViolations(point), [], `${entry.id} summary[${index}]`);
    }
    assert.deepEqual(glossaryViolations(entry.deepDiveMarkdown), [], `${entry.id} deep dive`);
  }
});
