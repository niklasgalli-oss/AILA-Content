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

test("custom domain is documented, not switched on", () => {
  assert.equal(existsSync(join(root, "CNAME")), false);
  assert.equal(existsSync(join(root, "docs/CNAME")), false);
  const doc = read("docs/landing-domain.md");
  assert.match(doc, /185\.199\.108\.153/);
  assert.match(doc, /185\.199\.111\.153/);
  assert.match(doc, /2606:50c0:8000::153/);
  assert.match(doc, /2606:50c0:8003::153/);
  assert.match(doc, /niklasgalli-oss\.github\.io/);
  assert.match(doc, /Enforce HTTPS/);
  assert.match(doc, /MX/);
  assert.match(doc, /apple-app-site-association/);
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
    assert.match(html, /niklas\.galli@getaila\.de/);
    assert.match(html, /data-briefing-list/);
    assert.equal((html.match(/class="brief-item"/g) || []).length, 3);
    assert.equal((html.match(/class="level /g) || []).length, 3);
    assert.doesNotMatch(html, /fonts\.googleapis\.com/);
    assert.doesNotMatch(html, /googletagmanager|google-analytics|plausible|cdn\.jsdelivr/i);
  }
  assert.match(en, /Coming to the App Store/);
  assert.match(en, /Learn AI/);
  assert.match(en, /Android follows/);
  assert.match(de, /Bald im App Store/);
  assert.match(de, /Android folgt/);
  assert.match(de, /KI lernen/);
  assert.match(en, /href="impressum\/"/);
  assert.match(en, /href="privacy\/en\/"/);
  assert.match(de, /href="\.\.\/impressum\/"/);
  assert.match(de, /href="\.\.\/privacy\/"/);
});

test("landing assets stay self-hosted and flat-colored", () => {
  const css = read("docs/landing.css");
  assert.match(css, /bricolage-grotesque-latin\.woff2/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|fonts\.googleapis/i);
  assert.equal(existsSync(join(root, "docs/assets/bricolage-grotesque-latin.woff2")), true);
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
  assert.match(sitemap, /AILA-Content\/de\//);
  assert.match(sitemap, /AILA-Content\/privacy\//);
  assert.match(sitemap, /AILA-Content\/impressum\//);
});
