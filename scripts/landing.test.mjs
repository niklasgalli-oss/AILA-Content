import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

test("custom domain is getaila.de", () => {
  assert.equal(existsSync(join(root, "CNAME")), false);
  assert.equal(read("docs/CNAME").trim(), "getaila.de");
  const doc = read("docs/landing-domain.md");
  assert.match(doc, /185\.199\.108\.153/);
  assert.match(doc, /185\.199\.111\.153/);
  assert.match(doc, /2606:50c0:8000::153/);
  assert.match(doc, /2606:50c0:8003::153/);
  assert.match(doc, /niklasgalli-oss\.github\.io/);
  assert.match(doc, /Enforce HTTPS/);
  assert.match(doc, /MX/);
  assert.match(doc, /apple-app-site-association/);
  assert.match(read("docs/index.html"), /rel="canonical" href="https:\/\/getaila\.de\/"/);
  assert.match(read("docs/index.html"), /property="og:url" content="https:\/\/getaila\.de\/"/);
  assert.match(read("docs/de/index.html"), /rel="canonical" href="https:\/\/getaila\.de\/de\/"/);
  assert.match(read("docs/de/index.html"), /property="og:url" content="https:\/\/getaila\.de\/de\/"/);
  assert.match(read("docs/sitemap.xml"), /<loc>https:\/\/getaila\.de\/<\/loc>/);
  assert.match(read("docs/sitemap.xml"), /<loc>https:\/\/getaila\.de\/de\/<\/loc>/);
  for (const path of [
    "docs/index.html",
    "docs/de/index.html",
    "docs/sitemap.xml",
    "docs/robots.txt",
    "docs/privacy/index.html",
    "docs/privacy/en/index.html",
    "docs/impressum/index.html"
  ]) {
    assert.doesNotMatch(read(path), /github\.io\/AILA-Content/);
  }
});

test("apple-app-site-association is not a file", () => {
  const paths = walk(root).map((path) => path.slice(root.length + 1));
  const hit = paths.filter((path) => path.includes("apple-app-site-association"));
  assert.deepEqual(hit, []);
});

test("App Store URL is one empty constant", () => {
  const js = read("docs/landing.js");
  assert.match(js, /const AILA_APP_STORE_URL = "";/);
  assert.equal((js.match(/const AILA_APP_STORE_URL/g) || []).length, 1);
});

test("English and German pages carry the landing sections", () => {
  const en = read("docs/index.html");
  const de = read("docs/de/index.html");
  for (const html of [en, de]) {
    assert.match(html, /rel="alternate" hreflang="en"/);
    assert.match(html, /rel="alternate" hreflang="de"/);
    assert.match(html, /rel="alternate" hreflang="x-default"/);
    assert.match(html, /og:image/);
    assert.match(html, /AILA for Teams/);
    assert.match(html, /hallo@getaila\.de/);
    assert.doesNotMatch(html, /niklas\.galli@getaila\.de/);
    assert.doesNotMatch(html, /Niklas Galli/);
    assert.doesNotMatch(html, /Neuburger/);
    assert.doesNotMatch(html, /Karlshuld/);
    assert.match(html, /data-briefing-list/);
    assert.equal((html.match(/class="brief-item"/g) || []).length, 3);
    assert.equal((html.match(/class="level /g) || []).length, 3);
    assert.doesNotMatch(html, /fonts\.googleapis\.com/);
    assert.doesNotMatch(html, /googletagmanager|google-analytics|plausible|cdn\.jsdelivr/i);
  }
  assert.match(en, /Coming soon on App Store/);
  assert.match(en, /Coming soon on Google Play/);
  assert.match(en, /Learn AI/);
  assert.match(en, /Android follows/);
  assert.match(de, /Demnächst im App Store/);
  assert.match(de, /Demnächst bei Google Play/);
  assert.match(de, /Android folgt/);
  assert.match(de, /KI lernen/);
  assert.match(en, /href="impressum\/"/);
  assert.match(en, /href="privacy\/en\/"/);
  assert.match(en, /href="terms\/"/);
  assert.match(de, /href="\.\.\/impressum\/"/);
  assert.match(de, /href="\.\.\/privacy\/"/);
  assert.match(de, /href="nutzungsbedingungen\/"/);
});

test("landing assets stay self-hosted and flat-colored", () => {
  const css = read("docs/landing.css");
  assert.match(css, /fraunces-latin-600\.woff2/);
  assert.match(css, /source-sans-3-latin-400\.woff2/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|fonts\.googleapis/i);
  assert.equal(existsSync(join(root, "docs/assets/fraunces-latin-600.woff2")), true);
  assert.equal(existsSync(join(root, "docs/assets/aila-head-full.webp")), true);
  assert.equal(existsSync(join(root, "docs/assets/source-sans-3-latin-400.woff2")), true);
  assert.equal(existsSync(join(root, "docs/assets/OFL.txt")), true);
  assert.equal(existsSync(join(root, "docs/assets/app-store-badge-en.svg")), true);
  assert.equal(existsSync(join(root, "docs/assets/app-store-badge-de.svg")), true);
  assert.equal(existsSync(join(root, "docs/og.png")), true);
  assert.equal(existsSync(join(root, "docs/og-de.png")), true);
  assert.equal(existsSync(join(root, "docs/favicon.svg")), true);
  assert.equal(existsSync(join(root, "docs/robots.txt")), true);
  assert.equal(existsSync(join(root, "docs/sitemap.xml")), true);
  const robots = read("docs/robots.txt");
  const sitemap = read("docs/sitemap.xml");
  assert.match(robots, /sitemap\.xml/);
  assert.match(sitemap, /https:\/\/getaila\.de\/de\//);
  assert.match(sitemap, /https:\/\/getaila\.de\/privacy\//);
  assert.match(sitemap, /https:\/\/getaila\.de\/impressum\//);
  assert.match(sitemap, /https:\/\/getaila\.de\/terms\//);
  assert.match(sitemap, /https:\/\/getaila\.de\/de\/nutzungsbedingungen\//);
});

test("name and address stay on the imprint only", () => {
  const publicPages = [
    "docs/index.html",
    "docs/de/index.html",
    "docs/privacy/index.html",
    "docs/privacy/en/index.html",
    "docs/terms/index.html",
    "docs/de/nutzungsbedingungen/index.html"
  ];
  for (const path of publicPages) {
    const html = read(path);
    assert.doesNotMatch(html, /Niklas Galli/, path);
    assert.doesNotMatch(html, /Neuburger/, path);
    assert.doesNotMatch(html, /Karlshuld/, path);
    assert.doesNotMatch(html, /niklas\.galli@/, path);
    assert.match(html, /hallo@getaila\.de/, path);
  }
  const imprint = read("docs/impressum/index.html");
  assert.match(imprint, /Niklas Galli/);
  assert.match(imprint, /Neuburger Straße 73a/);
  assert.match(imprint, /86668 Karlshuld/);
  assert.match(imprint, /hallo@getaila\.de/);
  assert.doesNotMatch(imprint, /niklas\.galli@/);
  assert.doesNotMatch(imprint, /tel:/i);
  assert.doesNotMatch(imprint, /\+49/);
  const dePrivacy = read("docs/privacy/index.html");
  const enPrivacy = read("docs/privacy/en/index.html");
  assert.doesNotMatch(dePrivacy, /kein Quiz/i);
  assert.doesNotMatch(enPrivacy, /no quiz/i);
  assert.match(dePrivacy, /RevenueCat/);
  assert.match(enPrivacy, /RevenueCat/);
  assert.match(dePrivacy, /Kein Tracking/);
  assert.match(enPrivacy, /No tracking/);
  const deTerms = read("docs/de/nutzungsbedingungen/index.html");
  const enTerms = read("docs/terms/index.html");
  assert.match(deTerms, /Produkthaftungsgesetz/);
  assert.match(deTerms, /wesentlichen Vertragspflicht/);
  assert.match(enTerms, /Product Liability Act/);
  assert.match(enTerms, /essential contractual duty/);
  assert.match(deTerms, /stdeula/);
  assert.match(enTerms, /stdeula/);
  for (const html of [
    read("docs/index.html"),
    read("docs/de/index.html"),
    read("docs/impressum/index.html"),
    dePrivacy,
    enPrivacy,
    deTerms,
    enTerms
  ]) {
    assert.match(html, /KI erstellt oder unterstützt|generated or assisted by AI/);
  }
});
