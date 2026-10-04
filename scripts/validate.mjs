import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(root, "schema", "pulse.schema.json");
const pulsePath = join(root, "pulse.json");

const TAGS = [
  "Model Release",
  "Framework",
  "Autonomous Agent",
  "Benchmarks",
  "Hardware",
];

const HEADINGS = [
  "## The Hook",
  "## The Core Mechanism",
  "## The Trade-off",
  "## Practical Takeaway",
];

const ID_RE = /^pulse-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_RE =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

const errors = [];

function fail(path, message) {
  errors.push(`${path}: ${message}`);
}

function loadJson(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    fail(path, `unreadable (${error.message})`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(path, `invalid JSON (${error.message})`);
    return null;
  }
}

function headingsOf(markdown) {
  return String(markdown)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("## "));
}

function checkDeepDive(path, markdown) {
  if (typeof markdown !== "string" || markdown.trim() === "") {
    fail(path, "deepDiveMarkdown must be a non-empty string");
    return;
  }
  const found = headingsOf(markdown);
  if (found.length !== 4) {
    fail(path, `expected exactly 4 '## ' sections, found ${found.length}`);
    return;
  }
  for (let i = 0; i < HEADINGS.length; i += 1) {
    if (found[i] !== HEADINGS[i]) {
      fail(path, `section ${i + 1} must be "${HEADINGS[i]}", found "${found[i]}"`);
    }
  }
}

function checkSummary(path, points) {
  if (!Array.isArray(points) || points.length !== 3) {
    fail(path, "summaryPoints must contain exactly 3 strings");
    return;
  }
  points.forEach((point, index) => {
    if (typeof point !== "string" || point.trim() === "") {
      fail(`${path}[${index}]`, "summary point must be a non-empty string");
    }
  });
}

function checkLocalized(path, copy) {
  if (copy === null || typeof copy !== "object" || Array.isArray(copy)) {
    fail(path, "localized copy must be an object");
    return;
  }
  for (const key of ["headline", "hook", "takeaway", "deepDiveMarkdown", "summaryPoints"]) {
    if (!(key in copy)) fail(path, `missing ${key}`);
  }
  if (typeof copy.headline !== "string") {
    fail(`${path}.headline`, "must be a string");
  } else if ([...copy.headline].length > 60) {
    fail(`${path}.headline`, `must be <= 60 characters (is ${[...copy.headline].length})`);
  } else if (copy.headline.trim() === "") {
    fail(`${path}.headline`, "must be non-empty");
  }
  for (const key of ["hook", "takeaway"]) {
    if (typeof copy[key] !== "string" || copy[key].trim() === "") {
      fail(`${path}.${key}`, "must be a non-empty string");
    }
  }
  checkSummary(`${path}.summaryPoints`, copy.summaryPoints);
  checkDeepDive(`${path}.deepDiveMarkdown`, copy.deepDiveMarkdown);
}

function assertSchemaShape(schema) {
  if (!schema || schema.type !== "array") fail("schema", "root type must be array");
  if (schema.maxItems !== 12) fail("schema", "maxItems must be 12");
  const item = schema?.$defs?.dailyPulseItem;
  const tags = item?.properties?.tag?.enum;
  if (!Array.isArray(tags) || tags.join("|") !== TAGS.join("|")) {
    fail("schema", "tag enum drifted from the validator");
  }
  if (item?.properties?.headline?.maxLength !== 60) {
    fail("schema", "headline maxLength must be 60");
  }
  const points = item?.properties?.summaryPoints;
  if (points?.minItems !== 3 || points?.maxItems !== 3) {
    fail("schema", "summaryPoints must be exactly 3");
  }
  if (!item?.properties?.i18n?.required?.includes("de")) {
    fail("schema", "i18n.de must be required");
  }
}

const schema = loadJson(schemaPath);
const pulse = loadJson(pulsePath);
assertSchemaShape(schema);

if (!Array.isArray(pulse)) {
  fail("pulse.json", "must be a JSON array");
} else {
  if (pulse.length < 1 || pulse.length > 12) {
    fail("pulse.json", `must contain 1 to 12 items (has ${pulse.length})`);
  }
  const ids = new Set();
  pulse.forEach((item, index) => {
    const path = `pulse.json[${index}]`;
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      fail(path, "must be an object");
      return;
    }
    if (typeof item.id !== "string" || !ID_RE.test(item.id)) {
      fail(`${path}.id`, "must match pulse-YYYY-MM-DD-short-slug");
    } else if (ids.has(item.id)) {
      fail(`${path}.id`, `duplicate id ${item.id}`);
    } else {
      ids.add(item.id);
    }
    if (typeof item.date !== "string" || !ISO_RE.test(item.date) || Number.isNaN(Date.parse(item.date))) {
      fail(`${path}.date`, "must be an ISO-8601 UTC timestamp with millisecond precision");
    } else if (typeof item.id === "string" && !item.id.startsWith(`pulse-${item.date.slice(0, 10)}-`)) {
      fail(`${path}.id`, "date prefix must match the UTC calendar date");
    }
    if (!TAGS.includes(item.tag)) {
      fail(`${path}.tag`, `must be one of ${TAGS.join(", ")}`);
    }
    for (const key of ["readTimeMinutes", "listenTimeMinutes"]) {
      const value = item[key];
      if (!Number.isInteger(value) || value < 1 || value > 30) {
        fail(`${path}.${key}`, "must be an integer from 1 to 30");
      }
    }
    checkLocalized(path, {
      headline: item.headline,
      hook: item.hook,
      summaryPoints: item.summaryPoints,
      takeaway: item.takeaway,
      deepDiveMarkdown: item.deepDiveMarkdown,
    });
    const source = item.source;
    if (!source || typeof source !== "object") {
      fail(`${path}.source`, "must be an object with name and url");
    } else {
      if (typeof source.name !== "string" || source.name.trim() === "") {
        fail(`${path}.source.name`, "must be a non-empty string");
      }
      if (typeof source.url !== "string" || !source.url.startsWith("https://")) {
        fail(`${path}.source.url`, "must be an https URL");
      } else {
        try {
          const parsed = new URL(source.url);
          if (parsed.protocol !== "https:") fail(`${path}.source.url`, "must be https");
        } catch {
          fail(`${path}.source.url`, "must be a valid URL");
        }
      }
    }
    if (!item.i18n || typeof item.i18n !== "object" || !item.i18n.de) {
      fail(`${path}.i18n.de`, "German copy is required");
    } else {
      checkLocalized(`${path}.i18n.de`, item.i18n.de);
    }
  });
}

if (errors.length > 0) {
  console.error(`pulse.json failed validation (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`pulse.json ok (${pulse.length} item${pulse.length === 1 ? "" : "s"})`);
