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

const TAG_LABEL = {
  en: {
    "Model Release": "New model",
    "Autonomous Agent": "AI agents",
    Benchmarks: "Study",
    Tools: "Everyday tool",
    Framework: "In the background",
    Hardware: "Device"
  },
  de: {
    "Model Release": "Neues Modell",
    "Autonomous Agent": "KI-Agenten",
    Benchmarks: "Studie",
    Tools: "Alltags-Tool",
    Framework: "Im Hintergrund",
    Hardware: "Gerät"
  }
};

const JARGON = /open[- ]?weights|benchmarks?|per million|pro Million|\bAPI\b|\$\s?\d|\d\s?\$|parameter|MoE|context window|\binference\b|GPT-\d|\bvon\s+\d{2,}\b|\bof\s+\d{2,}\b|llama|vLLM|Token-Limit|pro Token/i;

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

function plainEnough(item, locale) {
  if (textOrEmpty(item && item.level) === "advanced") return false;
  const copy = copyFor(item, locale);
  return !JARGON.test(`${copy.headline} ${copy.summary}`);
}

function renderItem(item, locale) {
  const copy = copyFor(item, locale);
  if (!copy.headline || !copy.summary) return null;
  const li = document.createElement("li");
  li.className = "brief-item";

  const meta = document.createElement("p");
  meta.className = "item-meta";
  const tag = textOrEmpty(item.tag);
  const labels = TAG_LABEL[locale] || TAG_LABEL.en;
  const label = (tag && labels[tag]) || tag;
  if (label) {
    meta.textContent = label;
    li.append(meta);
  }

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
    const picked = day.items.filter((item) => plainEnough(item, locale)).slice(0, 3);
    if (picked.length < 3) return;
    const nodes = picked.map((item) => renderItem(item, locale)).filter(Boolean);
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

function wirePhoneShots() {
  document.querySelectorAll(".phone-shot").forEach((img) => {
    const drop = () => {
      const screen = img.closest(".phone-screen");
      if (screen) screen.classList.add("is-pending");
      img.remove();
    };
    if (img.complete && img.naturalWidth === 0) drop();
    else img.addEventListener("error", drop, { once: true });
  });
}

wireStore();
loadBriefing();
wirePhoneShots();
wireEditionMotion();

function inOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function inOutSin(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function sampleTrack(segments, elapsed) {
  const total = segments.reduce((sum, seg) => sum + seg.d, 0);
  let time = elapsed % total;
  let from = segments[segments.length - 1].v;
  for (const seg of segments) {
    if (time <= seg.d) {
      const u = seg.d === 0 ? 1 : time / seg.d;
      const ease = seg.ease || inOutQuad;
      return from + (seg.v - from) * ease(u);
    }
    time -= seg.d;
    from = seg.v;
  }
  return from;
}

const AILA_EYES = {
  l: { cx: 160, cy: 278 },
  r: { cx: 362, cy: 278 }
};

const AILA_BLINK = [
  { v: 0.6, d: 4200 },
  { v: 0.38, d: 160 },
  { v: 0.6, d: 240 }
];

const AILA_BROW = [
  { v: 0, d: 1600 },
  { v: -3, d: 480 },
  { v: 1.2, d: 640 },
  { v: 0, d: 520 }
];

const AILA_TILT = [
  { v: -1.6, d: 2600, ease: inOutSin },
  { v: 1.8, d: 2800, ease: inOutSin },
  { v: 0, d: 1800, ease: inOutSin }
];

const AILA_LOOK_Y = [
  { v: -6, d: 110 },
  { v: -6, d: 860 },
  { v: -3, d: 80 },
  { v: -3, d: 520 },
  { v: 1, d: 150 },
  { v: 1, d: 400 },
  { v: -5, d: 120 },
  { v: -5, d: 980 }
];

const AILA_FLOAT = [
  { v: -5, d: 1700, ease: inOutSin },
  { v: 0, d: 1700, ease: inOutSin }
];

const AILA_BROW_BIAS = { happy: -6, wave: -6, thinking: -2, neutral: 0 };

function lookXTrack(side) {
  const rest = side * 18;
  return [
    { v: rest, d: 110 },
    { v: rest, d: 780 },
    { v: rest - side * 6, d: 80 },
    { v: rest - side * 6, d: 460 },
    { v: rest + side * 4, d: 70 },
    { v: rest + side * 4, d: 620 },
    { v: 0, d: 150 },
    { v: 0, d: 420 },
    { v: rest, d: 130 },
    { v: rest, d: 900 }
  ];
}

function paintAila(mark, state) {
  const blink = state.blink;
  const drop = (1 - blink) * 18;
  const glossOn = blink > 0.5;
  const biasX = state.biasX;
  const biasY = state.biasY;
  mark.querySelectorAll("[data-eye]").forEach((el) => {
    const eye = AILA_EYES[el.dataset.eye];
    const part = el.dataset.part;
    const lookX = state.lookX;
    const lookY = state.lookY;
    if (part === "white") {
      el.setAttribute("cx", eye.cx);
      el.setAttribute("cy", eye.cy + drop);
      el.setAttribute("rx", 50);
      el.setAttribute("ry", 54 * blink);
    } else if (part === "iris") {
      el.setAttribute("cx", eye.cx + lookX * 0.4 + biasX * 0.35);
      el.setAttribute("cy", eye.cy + drop + lookY * 0.35 + biasY * 0.3);
      el.setAttribute("rx", 34);
      el.setAttribute("ry", 34 * blink);
    } else if (part === "pupil") {
      el.setAttribute("cx", eye.cx + lookX + biasX * 0.5);
      el.setAttribute("cy", eye.cy + drop + 2 + lookY + biasY * 0.4);
      el.setAttribute("rx", 9);
      el.setAttribute("ry", 10 * blink);
    } else if (part === "gloss") {
      el.setAttribute("cx", eye.cx + 12 + lookX * 0.2);
      el.setAttribute("cy", eye.cy - 14 + lookY * 0.15);
      el.setAttribute("rx", 7);
      el.setAttribute("ry", 4.5);
      el.setAttribute("opacity", glossOn ? 0.8 : 0);
    } else if (part === "small") {
      el.setAttribute("cx", eye.cx - 6 + lookX * 0.2);
      el.setAttribute("cy", eye.cy - 4 + lookY * 0.15);
      el.setAttribute("rx", 3);
      el.setAttribute("ry", 2);
      el.setAttribute("opacity", glossOn ? 0.45 : 0);
    }
  });
  const bias = AILA_BROW_BIAS[mark.dataset.mood || "neutral"] || 0;
  const raised = state.brow + bias < -2;
  mark.querySelector(".brows-rest").setAttribute("opacity", raised ? "0" : "1");
  mark.querySelector(".brows-raised").setAttribute("opacity", raised ? "1" : "0");
  const mouth = state.mouth;
  const open = mark.querySelector(".mouth-open");
  open.setAttribute("ry", 3.5 + mouth * 7);
  open.setAttribute("opacity", mouth > 0.15 ? 0.85 : 0);
  const earOpacity = state.ear * 0.85;
  mark.querySelectorAll(".ear").forEach((el) => el.setAttribute("opacity", earOpacity));
  mark.style.setProperty("--aila-nod", state.nod + "px");
  mark.style.setProperty("--aila-turn", (state.tilt + state.wave + state.talkTilt) + "deg");
  if (mark.hasAttribute("data-float")) {
    const host = mark.closest(".aila-float") || mark;
    host.style.setProperty("--aila-float", state.floatY + "px");
  }
}

function ailaSide(mark) {
  return mark.dataset.gaze === "right" ? 1 : -1;
}

function restAilaState(mark) {
  const mood = mark.dataset.mood || "neutral";
  const thinking = mood === "thinking";
  return {
    blink: 0.6,
    lookX: ailaSide(mark) * 16,
    lookY: -4,
    brow: 0,
    tilt: 0,
    floatY: 0,
    nod: 0,
    wave: 0,
    talkTilt: 0,
    ear: 0,
    mouth: 0,
    biasX: thinking ? -6 : 0,
    biasY: thinking ? -4 : 0
  };
}

function movingAilaState(mark, elapsed) {
  const mood = mark.dataset.mood || "neutral";
  const thinking = mood === "thinking";
  const side = ailaSide(mark);
  return {
    blink: sampleTrack(AILA_BLINK, elapsed),
    lookX: sampleTrack(lookXTrack(side), elapsed),
    lookY: sampleTrack(AILA_LOOK_Y, elapsed),
    brow: sampleTrack(AILA_BROW, elapsed),
    tilt: sampleTrack(AILA_TILT, elapsed),
    floatY: mark.hasAttribute("data-float") ? sampleTrack(AILA_FLOAT, elapsed) : 0,
    nod: 0,
    wave: 0,
    talkTilt: 0,
    ear: 0,
    mouth: 0,
    biasX: thinking ? -6 : 0,
    biasY: thinking ? -4 : 0
  };
}

function wireAila() {
  const marks = [...document.querySelectorAll("[data-aila-mark]")];
  if (!marks.length) return;
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  const paintAll = (elapsed, moving) => {
    marks.forEach((mark) => {
      paintAila(mark, moving ? movingAilaState(mark, elapsed) : restAilaState(mark));
    });
  };
  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    paintAll(0, false);
  };
  const start = (now0) => {
    const origin = now0;
    const tick = (now) => {
      paintAll(now - origin, true);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    stop();
    if (!motionQuery.matches) start(performance.now());
  };
  sync();
  motionQuery.addEventListener("change", sync);
}

function wireEditionMotion() {
  const header = document.getElementById("site-header");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const floater = document.querySelector(".aila-float");
  const hero = document.getElementById("hero-section");
  const onScroll = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 20);
    const top = document.getElementById("back-to-top");
    if (top) top.classList.toggle("is-visible", window.scrollY > 500);
    if (floater) {
      const pastHero = !hero || hero.getBoundingClientRect().bottom <= 96;
      floater.classList.toggle("is-visible", pastHero);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = document.getElementById("mobile-menu-btn");
  const panel = document.getElementById("mobile-nav-panel");
  const backdrop = document.getElementById("nav-backdrop");
  const setNav = (open) => {
    panel?.classList.toggle("active", open);
    backdrop?.classList.toggle("active", open);
    burger?.setAttribute("aria-expanded", open ? "true" : "false");
    if (panel) {
      if (open) panel.removeAttribute("inert");
      else panel.setAttribute("inert", "");
    }
    document.body.style.overflow = open ? "hidden" : "";
  };
  burger?.addEventListener("click", () => {
    setNav(burger.getAttribute("aria-expanded") !== "true");
  });
  backdrop?.addEventListener("click", () => setNav(false));
  panel?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setNav(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setNav(false);
  });

  const links = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll("main section[id]");
  if (sections.length && "IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === "#" + id);
        });
      });
    }, { threshold: 0.3 });
    sections.forEach((section) => navObserver.observe(section));
  }

  const back = document.getElementById("back-to-top");
  back?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });

  if (!reduce && "IntersectionObserver" in window) {
    document.documentElement.classList.add("has-reveal");
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    document.querySelectorAll(".reveal-text").forEach((el) => revealObserver.observe(el));
  }
}

wireAila();
