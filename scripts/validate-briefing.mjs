import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { glossaryViolations, httpsUrlError } from "./validate.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(root, "schema", "briefing.schema.json");
const pulseSchemaPath = join(root, "schema", "pulse.schema.json");
const briefingPath = join(root, "briefing.json");
const pulsePath = join(root, "pulse.json");

const LEVELS = ["beginner", "advanced"];
const PRIORITIES = ["normal", "breaking"];

const ROOT_KEYS = ["schemaVersion", "updatedAt", "days"];
const DAY_KEYS = ["date", "items"];
const ITEM_KEYS = ["id", "headline", "summary", "source", "tag", "priority", "pulseId", "level", "i18n"];
const COPY_KEYS = ["headline", "summary"];

const ID_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PULSE_ID_RE = /^pulse-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const UPDATED_AT_RE =
  /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]+))?([+-])([0-9]{2}):([0-9]{2})$/;

const TAG_REF = "pulse.schema.json#/$defs/dailyPulseItem/properties/tag";
const PRIORITY_REF = "pulse.schema.json#/$defs/dailyPulseItem/properties/priority";

function charLength(value) {
  return [...value].length;
}

function inRange(value, min, max) {
  const number = Number(value);
  return number >= min && number <= max;
}

function isRealDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!inRange(month, 1, 12) || !inRange(day, 1, 31)) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function sentenceCount(text) {
  if (typeof text !== "string" || text.trim() === "") return 0;
  const masked = text.replace(/(\d)\.(\d)/g, "$1·$2");
  return masked
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "").length;
}

export function updatedAtError(value) {
  if (typeof value !== "string") return "must be an ISO-8601 date-time with a numeric offset";
  const match = UPDATED_AT_RE.exec(value);
  if (!match) {
    return "must be an ISO-8601 date-time with a numeric offset, for example 2026-10-08T04:45:00+02:00";
  }
  const [, year, month, day, hour, minute, second, , , offsetHour, offsetMinute] = match;
  if (!isRealDate(year, month, day)) return "must use a real calendar date";
  if (!inRange(hour, 0, 23) || !inRange(minute, 0, 59) || !inRange(second, 0, 59)) {
    return "must use a real time of day";
  }
  if (!inRange(offsetHour, 0, 23) || !inRange(offsetMinute, 0, 59)) {
    return "must use a real numeric offset";
  }
  return null;
}

function dayDateError(value) {
  if (typeof value !== "string") return "must be a YYYY-MM-DD date";
  const match = DAY_RE.exec(value);
  if (!match) return "must be a YYYY-MM-DD date";
  if (!isRealDate(match[1], match[2], match[3])) return "must be a real calendar date";
  return null;
}

function pointerGet(doc, pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return undefined;
  const parts = pointer
    .split("/")
    .slice(1)
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current = doc;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

function resolvePulseRef(ref, pulseSchema) {
  if (typeof ref !== "string") return undefined;
  const hash = ref.indexOf("#");
  if (hash === -1) return undefined;
  const file = ref.slice(0, hash);
  const pointer = ref.slice(hash + 1);
  if (file !== "pulse.schema.json") return undefined;
  return pointerGet(pulseSchema, pointer);
}

function sameList(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.join("|") === right.join("|");
}

function pulseTagEnum(pulseSchema) {
  const tags = pulseSchema?.$defs?.dailyPulseItem?.properties?.tag?.enum;
  return Array.isArray(tags) ? tags : null;
}

function pulsePriorityEnum(pulseSchema) {
  const values = pulseSchema?.$defs?.dailyPulseItem?.properties?.priority?.enum;
  return Array.isArray(values) ? values : null;
}

function pulseUrlPattern(pulseSchema) {
  return pulseSchema?.$defs?.dailyPulseItem?.properties?.source?.properties?.url?.pattern ?? "";
}

export function collectBriefingSchemaErrors(schema, pulseSchema) {
  const errors = [];
  const fail = (message) => errors.push(`schema: ${message}`);
  if (!schema || schema.type !== "object") fail("root type must be object");
  if (schema?.additionalProperties !== false) fail("root must reject extra fields");
  if (schema?.properties?.schemaVersion?.const !== 1) fail("schemaVersion must be const 1");
  const updatedAt = schema?.properties?.updatedAt?.pattern ?? "";
  if (!updatedAt.includes("[+-]") || updatedAt.includes("Z")) {
    fail("updatedAt pattern must require a numeric offset");
  }
  const days = schema?.properties?.days;
  if (days?.minItems !== 1 || days?.maxItems !== 7) fail("days must allow 1 to 7 entries");
  const day = schema?.$defs?.day;
  if (day?.additionalProperties !== false) fail("day must reject extra fields");
  const items = day?.properties?.items;
  if (items?.minItems !== 6 || items?.maxItems !== 8) fail("each day must have 6 to 8 items");
  const item = schema?.$defs?.item;
  if (item?.additionalProperties !== false) fail("item must reject extra fields");
  for (const key of ["id", "headline", "summary", "source", "tag", "i18n"]) {
    if (!item?.required?.includes(key)) fail(`item must require ${key}`);
  }
  for (const key of ["priority", "pulseId", "level"]) {
    if (item?.required?.includes(key)) fail(`${key} must not be required`);
  }
  if (item?.properties?.headline?.maxLength !== 60) fail("headline maxLength must be 60");
  if (item?.properties?.summary?.maxLength !== 240) fail("summary maxLength must be 240");
  const tag = item?.properties?.tag;
  const resolvedTag = tag?.$ref ? resolvePulseRef(tag.$ref, pulseSchema) : tag;
  const tags = pulseTagEnum(pulseSchema);
  if (tag?.$ref !== TAG_REF) fail(`tag must reference ${TAG_REF}`);
  if (!tags || !sameList(resolvedTag?.enum, tags)) fail("tag enum must match pulse.schema.json");
  const priority = item?.properties?.priority;
  const resolvedPriority = priority?.$ref ? resolvePulseRef(priority.$ref, pulseSchema) : priority;
  const priorities = pulsePriorityEnum(pulseSchema);
  if (priority?.$ref !== PRIORITY_REF) fail(`priority must reference ${PRIORITY_REF}`);
  if (!priorities || !sameList(resolvedPriority?.enum, priorities)) {
    fail("priority enum must match pulse.schema.json");
  }
  const levels = item?.properties?.level?.enum;
  if (!sameList(levels, LEVELS)) fail("level must be beginner or advanced");
  if (!item?.properties?.i18n?.required?.includes("de")) fail("i18n.de must be required");
  const copy = schema?.$defs?.localizedCopy;
  if (copy?.properties?.headline?.maxLength !== 60) fail("German headline maxLength must be 60");
  if (copy?.properties?.summary?.maxLength !== 240) fail("German summary maxLength must be 240");
  const source = item?.properties?.source;
  if (source?.additionalProperties !== false) fail("source must reject extra fields");
  const sourceRequired = source?.required ?? [];
  if (sourceRequired.length !== 2 || !sourceRequired.includes("name") || !sourceRequired.includes("url")) {
    fail("source must require name and url only");
  }
  const urlPattern = source?.properties?.url?.pattern ?? "";
  if (urlPattern !== pulseUrlPattern(pulseSchema)) {
    fail("source.url pattern must match pulse.schema.json");
  }
  if (!urlPattern.startsWith("^https://")) fail("source.url pattern must require https");
  return errors;
}

function checkLength(fail, path, value, max, label) {
  if (typeof value !== "string") {
    fail(path, "must be a string");
    return false;
  }
  const length = charLength(value);
  if (value.trim() === "" || length < 1) {
    fail(path, "must be non-empty");
    return false;
  }
  if (length > max) {
    fail(path, `${label} must be <= ${max} characters (is ${length})`);
    return false;
  }
  return true;
}

function checkGlossaryField(fail, path, text, options) {
  if (typeof text !== "string") return;
  for (const hit of glossaryViolations(text, options)) {
    fail(
      path,
      `capitalised glossary term "${hit.term}"; use "${hit.expected}" unless it is a product name or starts a sentence`,
    );
  }
}

function checkLocalized(fail, path, copy) {
  if (copy === null || typeof copy !== "object" || Array.isArray(copy)) {
    fail(path, "localized copy must be an object");
    return;
  }
  for (const key of Object.keys(copy)) {
    if (!COPY_KEYS.includes(key)) fail(path, `unexpected field ${key}`);
  }
  for (const key of COPY_KEYS) {
    if (!(key in copy)) fail(path, `missing ${key}`);
  }
  checkLength(fail, `${path}.headline`, copy.headline, 60, "headline");
  checkLength(fail, `${path}.summary`, copy.summary, 240, "summary");
}

function loadJson(path) {
  const text = readFileSync(path, "utf8");
  return JSON.parse(text);
}

function readPulseIds(pulse) {
  const ids = new Set();
  if (!Array.isArray(pulse)) return ids;
  for (const item of pulse) {
    if (item && typeof item.id === "string") ids.add(item.id);
  }
  return ids;
}

function readDefaultTags() {
  return pulseTagEnum(loadJson(pulseSchemaPath));
}

function readDefaultPulseIds() {
  return readPulseIds(loadJson(pulsePath));
}

export function lintBriefing(briefing, options = {}) {
  const errors = [];
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  let tags = options.tags;
  if (tags === undefined) {
    try {
      tags = readDefaultTags();
    } catch (error) {
      fail("schema/pulse.schema.json", `unreadable (${error.message})`);
      tags = null;
    }
  }
  let pulseIds = options.pulseIds;
  if (pulseIds === undefined) {
    try {
      pulseIds = readDefaultPulseIds();
    } catch (error) {
      fail("pulse.json", `unreadable (${error.message})`);
      pulseIds = new Set();
    }
  }

  if (briefing === null || typeof briefing !== "object" || Array.isArray(briefing)) {
    fail("briefing.json", "must be a JSON object");
    return { errors };
  }
  for (const key of Object.keys(briefing)) {
    if (!ROOT_KEYS.includes(key)) fail("briefing.json", `unexpected field ${key}`);
  }
  if (briefing.schemaVersion !== 1) fail("briefing.json.schemaVersion", "must be 1");
  const updatedAtProblem = updatedAtError(briefing.updatedAt);
  if (updatedAtProblem) fail("briefing.json.updatedAt", updatedAtProblem);

  if (!Array.isArray(briefing.days)) {
    fail("briefing.json.days", "must be an array");
    return { errors };
  }
  if (briefing.days.length < 1 || briefing.days.length > 7) {
    fail("briefing.json.days", `must contain 1 to 7 days (has ${briefing.days.length})`);
  }

  if (!Array.isArray(tags)) fail("briefing.json", "pulse tag enum is unavailable");

  const ids = new Map();
  const dates = new Map();

  briefing.days.forEach((day, dayIndex) => {
    const dayPath = `briefing.json.days[${dayIndex}]`;
    if (day === null || typeof day !== "object" || Array.isArray(day)) {
      fail(dayPath, "must be an object");
      return;
    }
    for (const key of Object.keys(day)) {
      if (!DAY_KEYS.includes(key)) fail(dayPath, `unexpected field ${key}`);
    }
    const dateProblem = dayDateError(day.date);
    if (dateProblem) {
      fail(`${dayPath}.date`, dateProblem);
    } else if (dates.has(day.date)) {
      fail(`${dayPath}.date`, `duplicate date ${day.date} (also ${dates.get(day.date)})`);
    } else {
      dates.set(day.date, dayPath);
      if (dayIndex > 0) {
        const previous = briefing.days[dayIndex - 1];
        if (typeof previous?.date === "string" && previous.date <= day.date) {
          fail(`${dayPath}.date`, "days must be sorted newest first");
        }
      }
    }

    if (!Array.isArray(day.items)) {
      fail(`${dayPath}.items`, "must be an array");
      return;
    }
    if (day.items.length < 6 || day.items.length > 8) {
      fail(`${dayPath}.items`, `must contain 6 to 8 items (has ${day.items.length})`);
    }

    day.items.forEach((item, itemIndex) => {
      const path = `${dayPath}.items[${itemIndex}]`;
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        fail(path, "must be an object");
        return;
      }
      for (const key of Object.keys(item)) {
        if (!ITEM_KEYS.includes(key)) fail(path, `unexpected field ${key}`);
      }
      if (typeof item.id !== "string" || !ID_RE.test(item.id)) {
        fail(`${path}.id`, "must match YYYY-MM-DD-short-slug");
      } else if (ids.has(item.id)) {
        fail(`${path}.id`, `duplicate id ${item.id} (also ${ids.get(item.id)})`);
      } else {
        ids.set(item.id, path);
        if (typeof day.date === "string" && !item.id.startsWith(`${day.date}-`)) {
          fail(`${path}.id`, "date prefix must match the day's date");
        }
      }
      const headlineOk = checkLength(fail, `${path}.headline`, item.headline, 60, "headline");
      const summaryOk = checkLength(fail, `${path}.summary`, item.summary, 240, "summary");
      if (headlineOk) checkGlossaryField(fail, `${path}.headline`, item.headline, { headline: true });
      if (summaryOk) {
        checkGlossaryField(fail, `${path}.summary`, item.summary);
        const sentences = sentenceCount(item.summary);
        if (sentences < 1 || sentences > 2) {
          fail(`${path}.summary`, `must be 1 or 2 sentences (is ${sentences})`);
        }
      }
      if (!Array.isArray(tags) || !tags.includes(item.tag)) {
        const list = Array.isArray(tags) ? tags.join(", ") : "the pulse tag enum";
        fail(`${path}.tag`, `must be one of ${list}`);
      }
      if (Object.prototype.hasOwnProperty.call(item, "priority") && !PRIORITIES.includes(item.priority)) {
        fail(`${path}.priority`, `must be one of ${PRIORITIES.join(", ")} when set`);
      }
      if (Object.prototype.hasOwnProperty.call(item, "level") && !LEVELS.includes(item.level)) {
        fail(`${path}.level`, `must be one of ${LEVELS.join(", ")} when set`);
      }
      if (Object.prototype.hasOwnProperty.call(item, "pulseId")) {
        if (typeof item.pulseId !== "string" || !PULSE_ID_RE.test(item.pulseId)) {
          fail(`${path}.pulseId`, "must match pulse-YYYY-MM-DD-short-slug");
        } else if (!pulseIds.has(item.pulseId)) {
          fail(`${path}.pulseId`, `unknown id ${item.pulseId}; it must exist in pulse.json`);
        }
      }
      const source = item.source;
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        fail(`${path}.source`, "must be an object with name and url");
      } else {
        for (const key of Object.keys(source)) {
          if (key !== "name" && key !== "url") fail(`${path}.source`, `unexpected field ${key}`);
        }
        if (typeof source.name !== "string" || source.name.trim() === "") {
          fail(`${path}.source.name`, "must be a non-empty publisher name");
        }
        const urlProblem = httpsUrlError(source.url);
        if (urlProblem) fail(`${path}.source.url`, urlProblem);
      }
      if (!item.i18n || typeof item.i18n !== "object" || Array.isArray(item.i18n)) {
        fail(`${path}.i18n`, "must be an object with de");
      } else {
        for (const key of Object.keys(item.i18n)) {
          if (key !== "de") fail(`${path}.i18n`, `unexpected field ${key}`);
        }
        if (!item.i18n.de) fail(`${path}.i18n.de`, "German copy is required");
        else checkLocalized(fail, `${path}.i18n.de`, item.i18n.de);
      }
    });
  });

  return { errors };
}

function parseArgs(argv) {
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") return { help: true };
    throw new Error(`unknown argument: ${arg}`);
  }
  return { help: false };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node scripts/validate-briefing.mjs");
    console.log("Checks schema/briefing.schema.json and briefing.json.");
    console.log("pulseId values must exist in pulse.json. No network.");
    return;
  }

  const errors = [];
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  let schema = null;
  let pulseSchema = null;
  let briefing = null;
  let pulseIds = new Set();

  try {
    schema = loadJson(schemaPath);
  } catch (error) {
    fail(schemaPath, `unreadable (${error.message})`);
  }
  try {
    pulseSchema = loadJson(pulseSchemaPath);
  } catch (error) {
    fail(pulseSchemaPath, `unreadable (${error.message})`);
  }
  try {
    briefing = loadJson(briefingPath);
  } catch (error) {
    fail(briefingPath, `unreadable (${error.message})`);
  }
  try {
    pulseIds = readPulseIds(loadJson(pulsePath));
  } catch (error) {
    fail(pulsePath, `unreadable (${error.message})`);
  }

  if (schema && pulseSchema) errors.push(...collectBriefingSchemaErrors(schema, pulseSchema));
  if (briefing) {
    const tags = pulseSchema ? pulseTagEnum(pulseSchema) : null;
    const result = lintBriefing(briefing, { pulseIds, tags });
    errors.push(...result.errors);
  }

  if (errors.length > 0) {
    console.error(`briefing.json failed validation (${errors.length} error${errors.length === 1 ? "" : "s"})`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const dayCount = Array.isArray(briefing?.days) ? briefing.days.length : 0;
  const itemCount = Array.isArray(briefing?.days)
    ? briefing.days.reduce((sum, day) => sum + (Array.isArray(day?.items) ? day.items.length : 0), 0)
    : 0;
  console.log(
    `briefing.json ok (${dayCount} day${dayCount === 1 ? "" : "s"}, ${itemCount} item${itemCount === 1 ? "" : "s"})`,
  );
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
