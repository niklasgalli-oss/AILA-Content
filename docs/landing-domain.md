# getaila.de on GitHub Pages

The site is published from the `/docs` folder on `main`. The public host is `https://getaila.de/`. `docs/CNAME` contains exactly `getaila.de`.

- https://getaila.de/
- https://getaila.de/de/
- https://getaila.de/privacy/
- https://getaila.de/privacy/en/
- https://getaila.de/impressum/
- https://getaila.de/terms/
- https://getaila.de/de/nutzungsbedingungen/

Once GitHub Pages has that custom domain, `https://niklasgalli-oss.github.io/AILA-Content/...` redirects to the same path on `https://getaila.de/...`. The `/AILA-Content` prefix is dropped. `www.getaila.de` redirects to the apex.

## Custom domain file

`docs/CNAME` is the publishing hostname, one line:

```
getaila.de
```

That file is not a DNS record. The apex stays on the A and AAAA records below. Do not put a CNAME on `@` in DNS. Links inside the pages are relative, so the same files work on `github.io` and on `getaila.de`.

## Mail stays where it is

`support@getaila.de` is the public contact mailbox on IONOS. Create that mailbox before the pages go live. The website records and the mail records are separate.

- Do not edit or delete MX records.
- Do not put a CNAME on the apex (`@`). An apex CNAME would take the place of the records mail needs.
- Do not edit TXT records that contain SPF, DKIM, or DMARC, or CNAMEs that belong to mail (autodiscover, DKIM selectors, and similar).

After the website records change, send a test message to `support@getaila.de` and confirm it still arrives. The MX answer from `dig` must be the same servers as before the edit.

## 1. Verify the domain first

Verification is a TXT record. It does not move the website and it does not touch mail. GitHub recommends it so another Pages site cannot claim `getaila.de`. Official steps: [Verifying your custom domain for GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages).

1. On GitHub, open the account that owns `niklasgalli-oss` → **Settings** → **Pages** → verify a domain.
2. GitHub shows a TXT host `_github-pages-challenge-niklasgalli-oss` and a token. Copy the token from that screen. Do not invent one.
3. In IONOS (steps below), add only that TXT record. Leave MX and the current website records alone until the cutover.

## 2. IONOS: website records for getaila.de

Panel labels move. The records are what matter. Sign in at [mein.ionos.de](https://mein.ionos.de/).

1. Open **Domains & SSL**.
2. Open **getaila.de**.
3. Open **DNS**.
4. Read the list before changing it. Write down every MX record: host, value, priority. IONOS mail is often `mx00.ionos.de` and `mx01.ionos.de` (sometimes `ionos.com`) at priority 10. Those stay.
5. If the domain is connected to an IONOS website or webspace, disconnect that website connection first. IONOS otherwise overwrites A records. Leave the e-mail product connected.
6. Remove only the website A and AAAA records on `@`, and a `www` record that points at IONOS parking. Do not remove MX. Do not remove mail TXT or mail CNAME records.
7. Add each row as its own record. Host `@` is the apex `getaila.de`.

| Type | Host | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `niklasgalli-oss.github.io` |

IONOS sometimes wants the CNAME target with a trailing dot: `niklasgalli-oss.github.io.`

The `www` CNAME points at `niklasgalli-oss.github.io`. It does not include the repository name, and it is not the `*.pages.github.io` host shown in the repository settings.

Do not add a wildcard such as `*.getaila.de`.

8. Check from a terminal:

```bash
dig getaila.de +noall +answer -t A
dig getaila.de +noall +answer -t AAAA
dig www.getaila.de +noall +answer -t CNAME
dig getaila.de +noall +answer -t MX
```

A must list all four `185.199.108.153`–`185.199.111.153` addresses. AAAA must list all four `2606:50c0:8000::153`–`2606:50c0:8003::153` addresses. The CNAME must be `niklasgalli-oss.github.io`. MX must still be the mailbox servers you wrote down.

GitHub notes that DNS can take up to 24 hours. IONOS is often faster. Stay on this step until the answers match.

Source for the addresses: [Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## 3. Turn the domain on

`docs/CNAME` is already `getaila.de`. Pages settings should match it: repository **niklasgalli-oss/AILA-Content** → **Settings** → **Pages**, source **Deploy from a branch**, branch **main**, folder **/docs**, custom domain `getaila.de` (the apex, not `www`).

From then on, `https://niklasgalli-oss.github.io/AILA-Content/privacy/` redirects to `https://getaila.de/privacy/`, and the same for the imprint, the English page, and `/de/`.

4. Wait until GitHub shows the DNS check as good and a certificate is issued. That can take up to 24 hours. [Securing your GitHub Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).
5. Then turn on **Enforce HTTPS** and leave it on. The checkbox stays disabled until the certificate exists. Do not force it earlier. If it never appears, extra A, AAAA, or CNAME records are the usual cause: remove the domain in Pages, clean the DNS, and add `getaila.de` again.
6. Open each of these and confirm the padlock:

- https://getaila.de/
- https://getaila.de/de/
- https://getaila.de/privacy/
- https://getaila.de/privacy/en/
- https://getaila.de/impressum/
- https://getaila.de/terms/
- https://getaila.de/de/nutzungsbedingungen/
- https://www.getaila.de/ redirects to https://getaila.de/
- https://niklasgalli-oss.github.io/AILA-Content/privacy/ redirects to https://getaila.de/privacy/
- https://niklasgalli-oss.github.io/AILA-Content/impressum/ redirects to https://getaila.de/impressum/

7. Send a test email to `support@getaila.de`.

The app can keep the old `github.io` links once those redirects answer, including over HTTPS. Update the app when you want the address itself to be `getaila.de`.

## 4. Absolute URLs

Canonical, hreflang, Open Graph, Twitter, JSON-LD, `docs/sitemap.xml`, and the Sitemap line in `docs/robots.txt` use `https://getaila.de`. The same host is on the privacy, imprint, and terms pages. Mail links stay `mailto:support@getaila.de`. The app still loads `pulse.json` and `briefing.json` from `raw.githubusercontent.com`.

`robots.txt` and `sitemap.xml` are host-root files. On the project URL they are under `/AILA-Content/`, which crawlers do not read as the `github.io` robots file. After the cutover they are `https://getaila.de/robots.txt` and `https://getaila.de/sitemap.xml`.

## App Store link

`docs/landing.js` has one constant, `AILA_APP_STORE_URL`. It is an empty string. That is the coming-soon state: the English page shows “Coming soon on App Store” and “Coming soon on Google Play”. The German page shows “Demnächst im App Store” and “Demnächst bei Google Play”. The Download badge is not rendered. Google Play has no URL on the page yet, so that line stays text.

Apple’s badge has to link to the product page, unmodified, once per page, at least 40px tall, with clear space of a quarter of its height. This page uses the official white badge at 48px with 12px of clear space, only after the constant is an `https://apps.apple.com/...` URL. English uses the US-UK artwork. German uses the DE artwork (“Laden im App Store”). The words App Store stay in English on the badge. Do not redraw it.

## apple-app-site-association

Do not add this file. It is not in the repository on purpose.

Universal Links need `apple-app-site-association` only after the iOS app is on the App Store and `getaila.de` is serving the site. Apple fetches:

- `https://getaila.de/.well-known/apple-app-site-association`
- and sometimes `https://getaila.de/apple-app-site-association`

No `.json` extension. The response `Content-Type` must be `application/json`. GitHub Pages does not set custom headers, and an extensionless file is often `application/octet-stream`, which Apple rejects. Check the header before relying on it.

When the Team ID and bundle id exist, the file would be JSON in this shape. `TEAMID.BUNDLEID` is a placeholder. The `exclude` lines keep Impressum, privacy, and the terms in the browser. Add a component for each path that should open the app; without one, nothing does.

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["TEAMID.BUNDLEID"],
        "components": [
          { "/": "/privacy", "exclude": true },
          { "/": "/privacy/*", "exclude": true },
          { "/": "/impressum", "exclude": true },
          { "/": "/impressum/*", "exclude": true },
          { "/": "/terms", "exclude": true },
          { "/": "/terms/*", "exclude": true },
          { "/": "/de/nutzungsbedingungen", "exclude": true },
          { "/": "/de/nutzungsbedingungen/*", "exclude": true }
        ]
      }
    ]
  }
}
```

## Local preview

GitHub Pages publishes `/docs` from `main` only, not from a pull request branch.

```bash
cd docs
python3 -m http.server 8080
```

Open http://localhost:8080/ and http://localhost:8080/de/ . The public pages are the `https://getaila.de/` URLs at the top of this file.
