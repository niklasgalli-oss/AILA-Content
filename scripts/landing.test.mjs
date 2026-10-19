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
    assert.match(html, /support@getaila\.de/);
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
  for (const pose of ["idle", "blink", "think", "cheer", "present"]) {
    assert.equal(existsSync(join(root, `docs/assets/aila-book/${pose}.webp`)), true);
  }
  assert.match(css, /@keyframes aila-bob/);
  assert.match(css, /@keyframes aila-blink/);
  const en = read("docs/index.html");
  const de = read("docs/de/index.html");
  assert.match(en, /assets\/aila-book\/idle\.webp/);
  assert.match(de, /assets\/aila-book\/idle\.webp/);
  assert.doesNotMatch(en, /aila-head-full/);
  assert.doesNotMatch(de, /aila-head-full/);
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
    assert.match(html, /support@getaila\.de/, path);
  }
  const imprint = read("docs/impressum/index.html");
  assert.match(imprint, /Niklas Galli/);
  assert.match(imprint, /Neuburger Straße 73a/);
  assert.match(imprint, /86668 Karlshuld/);
  assert.match(imprint, /support@getaila\.de/);
  assert.match(imprint, /innerhalb von 48 Stunden/);
  assert.match(imprint, /within 48 hours/);
  assert.match(imprint, /39,99 €/);
  assert.match(imprint, /7,99 €/);
  assert.match(imprint, /39\.99 €/);
  assert.match(imprint, /7\.99 €/);
  assert.doesNotMatch(imprint, /soweit Apple sie anbietet|where Apple offers it/);
  assert.doesNotMatch(imprint, /niklas\.galli@/);
  assert.doesNotMatch(imprint, /tel:/i);
  assert.doesNotMatch(imprint, /\+49/);
  const dePrivacy = read("docs/privacy/index.html");
  const enPrivacy = read("docs/privacy/en/index.html");
  assert.doesNotMatch(dePrivacy, /kein Quiz/i);
  assert.doesNotMatch(enPrivacy, /no quiz/i);
  assert.match(dePrivacy, /RevenueCat/);
  assert.match(enPrivacy, /RevenueCat/);
  assert.match(dePrivacy, /IONOS SE, Elgendorfer Str\. 57, 56410 Montabaur/);
  assert.match(enPrivacy, /IONOS SE, Elgendorfer Str\. 57, 56410 Montabaur/);
  assert.match(dePrivacy, /Art\. 28 DSGVO/);
  assert.match(enPrivacy, /Article 28 GDPR/);
  assert.doesNotMatch(dePrivacy, /soweit Apple sie anbietet|soweit der Store sie anbietet/);
  assert.doesNotMatch(enPrivacy, /where Apple offers it|where the store offers it/);
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
  assert.match(deTerms, /39,99 €/);
  assert.match(deTerms, /7,99 €/);
  assert.match(enTerms, /39\.99 €/);
  assert.match(enTerms, /7\.99 €/);
  assert.doesNotMatch(deTerms, /soweit Apple sie anbietet/);
  assert.doesNotMatch(enTerms, /where Apple offers it/);
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

test("story row, path, briefing fallback, and teams copy stay in sync", () => {
  const en = read("docs/index.html");
  const de = read("docs/de/index.html");
  const css = read("docs/landing.css");
  const js = read("docs/landing.js");
  const order = ["onboarding", "home", "lesson", "briefing"];

  for (const html of [en, de]) {
    const screens = html.slice(html.indexOf('id="screens"'), html.indexOf('id="learn"'));
    assert.deepEqual([...screens.matchAll(/data-story="([^"]+)"/g)].map((m) => m[1]), order);
    assert.equal((screens.match(/<figure/g) || []).length, 4);
    assert.doesNotMatch(screens, /<figcaption|phone-caption/);
    assert.doesNotMatch(screens, /activity-|\/home-/);
    assert.doesNotMatch(html, /Vector Databases/);
    assert.doesNotMatch(html, /kein Quiz|no quiz/i);
    assert.doesNotMatch(html, /Vier Fragen|Four questions/);
    assert.match(html, /class="prose"/);
    assert.match(html, /class="soon-badge"/);
    assert.match(html, /mailto:support@getaila\.de\?subject=/);
    assert.match(html, /Basics/);
    assert.match(html, /Core/);
    assert.match(html, /Depth/);
    assert.match(html, /7/);
    assert.doesNotMatch(html, /€|\$\s?\d/);
  }

  assert.match(de, /So lernst du mit AILA/);
  assert.match(en, /How you learn with AILA/);
  assert.match(de, /Drei Level\. Du startest dort, wo du stehst\./);
  assert.match(en, /Three levels\. You start where you stand\./);
  assert.doesNotMatch(de, /Ein Bild des Pfads|merkt es im Raum/);
  assert.doesNotMatch(en, /A picture of the path|too late to notice/);
  assert.match(de, /Das Modell kann nur eine bestimmte Menge Text auf einmal im Blick behalten\. Bei langen Chats vergisst es den Anfang\./);
  assert.match(en, /A model can only hold a certain amount of text in view at once\. In a long chat, it forgets the beginning\./);
  assert.match(de, /5 Min\./);
  assert.match(de, /Ohne Fachjargon/);
  assert.match(de, /Jeden Morgen/);
  assert.match(en, /5 min/);
  assert.match(en, /Without jargon/);
  assert.match(en, /Every morning/);
  assert.match(de, /Neue Wörter werden beim ersten Mal in normaler Sprache erklärt\./);
  assert.match(en, /New words are explained in plain language the first time they appear\./);
  assert.match(de, /ausreichende KI-Kompetenz ihrer Mitarbeitenden/);
  assert.match(en, /sufficient level of AI literacy/);
  assert.doesNotMatch(de, /Duolingo|müssen Unternehmen, die KI einsetzen, ihre Mitarbeitenden schulen/);
  assert.doesNotMatch(en, /Duolingo|have to train their staff/);
  assert.match(de, /Das Monatsabo hat keine Testphase/);
  assert.match(en, /The monthly plan has no trial/);
  assert.match(de, /Auf die Warteliste/);
  assert.match(en, /Join the waitlist/);
  assert.match(de, /Häufige Fragen\./);
  assert.match(en, /Common questions\./);
  assert.match(de, /Die Preise siehst du in der App/);
  assert.match(en, /You see the prices in the app/);
  assert.match(de, /Abonnements/);
  assert.match(en, /Subscriptions/);
  assert.match(de, /Deutsch und Englisch/);
  assert.match(en, /German and English/);
  assert.match(de, /KI-Agenten/);
  assert.match(de, /Alltags-Tool/);
  assert.match(de, /Im Hintergrund/);
  assert.doesNotMatch(de, /open weights|benchmarks/i);
  assert.doesNotMatch(en, /open weights|benchmarks/i);

  assert.match(css, /\.prose\s*\{[^}]*text-align:\s*justify/);
  assert.match(css, /hyphens:\s*auto/);
  assert.match(css, /\.compare-card ul\s*\{[^}]*list-style:\s*none/);
  assert.match(css, /\.phone-stage\.story-row[\s\S]*repeat\(4,/);
  assert.match(css, /\.phone-screen\.is-crop::after/);
  assert.match(en, /--mask:/);
  assert.match(de, /--mask:/);
  assert.match(js, /plainEnough/);
  assert.match(js, /Neues Modell/);
  assert.match(js, /if \(picked\.length < 3\) return/);
  assert.doesNotMatch(js, /pulse\.json/);

  const jargon = eval(js.match(/const JARGON = (\/[\s\S]+?\/i);/)[1]);
  const day = JSON.parse(read("briefing.json")).days[0];
  const plain = day.items.filter((item) => {
    const deCopy = item.i18n && item.i18n.de;
    const blob = `${item.headline} ${item.summary} ${deCopy.headline} ${deCopy.summary}`;
    return item.level !== "advanced" && !jargon.test(blob);
  });
  assert.equal(plain.length >= 3, true);
  const shown = plain.slice(0, 3).map((item) => item.headline);
  assert.deepEqual(shown, [
    "Second German court makes Google answer for its AI",
    "Anthropic sets aside 5% of its shares for public good",
    "Four Gemini agents beat Minecraft with no human help"
  ]);
  assert.equal(jargon.test(day.items[4].summary), true);
  assert.equal(jargon.test(day.items[6].summary), true);
});
