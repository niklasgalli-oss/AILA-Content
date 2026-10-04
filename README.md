# AILA-Content

Content feed for [AILA](https://github.com/niklasgalli-oss/AILA-Development), an Expo / React Native app for learning about AI. This repository holds the stories the app loads. The app code lives in the private app repo.

The app fetches one file at runtime:

```
https://raw.githubusercontent.com/niklasgalli-oss/AILA-Content/main/pulse.json
```

An AI news bot updates `pulse.json` three times a day. Each entry is a `DailyPulseItem`. English is the primary language in the top-level fields. German copy lives under `i18n.de`.

## Item shape

`pulse.json` is a JSON array. The contract is `schema/pulse.schema.json`. `scripts/validate.mjs` checks the file on every push (see `.github/workflows/validate-pulse.yml`).

Each item has:

| Field | Rule |
| --- | --- |
| `id` | `pulse-YYYY-MM-DD-short-slug`. URL-safe, stable, unique. The date prefix is the UTC calendar date of `date`. |
| `date` | ISO-8601 UTC timestamp with milliseconds, for example `2026-10-04T15:00:00.000Z`. |
| `tag` | One of `Model Release`, `Framework`, `Autonomous Agent`, `Benchmarks`, `Hardware`. |
| `readTimeMinutes`, `listenTimeMinutes` | Integers from 1 to 30. |
| `hook` | One sentence under the title. |
| `headline` | At most 60 characters. |
| `summaryPoints` | Exactly three strings: what the source shows, the limit of that claim, and what to check next. |
| `takeaway` | One concrete action. |
| `deepDiveMarkdown` | Exactly four `## ` sections, in this order: `The Hook`, `The Core Mechanism`, `The Trade-off`, `Practical Takeaway`. Aim for about 150–260 words in each section. |
| `source` | `{ "name", "url" }` with an `https` URL for a real publication. |
| `i18n.de` | `headline`, `hook`, `summaryPoints`, `takeaway`, and `deepDiveMarkdown`, with the same structure as English. |

Run the check locally:

```bash
node scripts/validate.mjs
```

## Rolling list of 12

Keep at most 12 items.

- Append a new item at the end of the array.
- When the list would pass 12, drop the oldest items from the front until 12 remain.
- Never reuse an `id`, including ids that have already rolled off the list.

## German copy

Write `i18n.de` in German, not as a sentence-by-sentence translation of the English. Keep technical AI terms in English. That includes Agent, Fine-Tuning, Context Window, Benchmark, Inference, Token, Reasoning, and Open Weights, along with model names, product names, and other established technical terms.
