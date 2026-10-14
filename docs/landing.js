/**
 * AILA landing config.
 *
 * AILA_APP_STORE_URL is the only App Store link. Leave it as "" until the
 * listing exists. An empty value keeps the coming-soon lines: English says
 * "Coming soon on App Store" and "Coming soon on Google Play". German says
 * "Demnächst im App Store" and "Demnächst bei Google Play". Neither page
 * shows a Download on the App Store badge while this stays empty. Google Play
 * has no URL yet, so that line stays coming soon.
 *
 * Apple's badge must link to the product page. When the listing is live, set
 * this to the https://apps.apple.com/... URL. The page then shows Apple's
 * official badge, unmodified, once, at 48px (minimum 40px) with 12px of clear
 * space. English uses the US-UK artwork. German uses the DE artwork
 * ("Laden im App Store"). App Store stays in English on the badge.
 */
const AILA_APP_STORE_URL = "";

const AILA_BRIEFING_URL = "https://raw.githubusercontent.com/niklasgalli-oss/AILA-Content/main/briefing.json";

const LEVEL_LABEL = {
  en: { beginner: "Beginner", advanced: "Advanced" },
  de: { beginner: "Einsteiger", advanced: "Vertieft" }
};

function appStoreProductUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" || url.hostname !== "apps.apple.com") return "";
  return url.toString();
}

function wireStore() {
  const root = document.querySelector("[data-aila-store]");
  if (!root) return;
  const href = appStoreProductUrl(AILA_APP_STORE_URL);
  if (!href) return;
  const pending = root.querySelector("[data-store-pending]");
  if (!pending) return;
  const link = document.createElement("a");
  link.className = "store-link";
  link.href = href;
  const img = document.createElement("img");
  img.src = root.dataset.badge;
  img.alt = root.dataset.badgeAlt || "Download on the App Store";
  img.width = 144;
  img.height = 48;
  link.append(img);
  pending.replaceWith(link);
}

function textOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function httpsUrl(value) {
  const raw = textOrEmpty(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function copyFor(item, locale) {
  const de = item && item.i18n && item.i18n.de;
  if (locale === "de" && de && textOrEmpty(de.headline) && textOrEmpty(de.summary)) {
    return { headline: de.headline.trim(), summary: de.summary.trim() };
  }
  return {
    headline: textOrEmpty(item && item.headline),
    summary: textOrEmpty(item && item.summary)
  };
}

function formatDay(iso, locale) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function renderItem(item, locale) {
  const copy = copyFor(item, locale);
  if (!copy.headline || !copy.summary) return null;
  const li = document.createElement("li");
  li.className = "brief-item";

  const meta = document.createElement("p");
  meta.className = "item-meta";
  const bits = [];
  const tag = textOrEmpty(item.tag);
  if (tag) bits.push(tag);
  const levelKey = textOrEmpty(item.level);
  const level = LEVEL_LABEL[locale] && LEVEL_LABEL[locale][levelKey];
  if (level) bits.push(level);
  meta.textContent = bits.join(" · ");
  if (bits.length) li.append(meta);

  const title = document.createElement("h3");
  title.textContent = copy.headline;
  li.append(title);

  const summary = document.createElement("p");
  summary.textContent = copy.summary;
  li.append(summary);

  const sourceName = textOrEmpty(item.source && item.source.name);
  const sourceUrl = httpsUrl(item.source && item.source.url);
  if (sourceName) {
    const source = document.createElement("p");
    source.className = "item-source";
    if (sourceUrl) {
      const a = document.createElement("a");
      a.href = sourceUrl;
      a.textContent = sourceName;
      source.append(a);
    } else {
      source.textContent = sourceName;
    }
    li.append(source);
  }
  return li;
}

async function loadBriefing() {
  const root = document.querySelector("[data-briefing]");
  if (!root) return;
  const list = root.querySelector("[data-briefing-list]");
  if (!list) return;
  const locale = root.dataset.locale === "de" ? "de" : "en";
  try {
    const response = await fetch(AILA_BRIEFING_URL, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return;
    const data = await response.json();
    const day = data && Array.isArray(data.days) ? data.days[0] : null;
    if (!day || !Array.isArray(day.items)) return;
    const nodes = day.items.slice(0, 3).map((item) => renderItem(item, locale)).filter(Boolean);
    if (!nodes.length) return;
    list.replaceChildren(...nodes);
    const time = root.querySelector("[data-briefing-date]");
    const label = formatDay(day.date, locale);
    if (time && label) {
      time.dateTime = day.date;
      time.textContent = label;
    }
    root.dataset.briefingState = "live";
  } catch {
    /* Static fallback stays. */
  }
}

wireStore();
loadBriefing();
