# Data Ingestion Guide

This project now includes a real-data import pipeline for MVP Phase 1.

## What It Does

The importer can:
- Fetch politician records from Wikidata
- Import politician records from local JSON
- Scrape parliamentary detail profiles from Mzalendo/Parliament pages
- Import legal cases from CSV
- Import promises from CSV
- Upsert existing rows instead of creating duplicates

Script location:
- `scripts/import_real_data.py`
- `scripts/scrape_parliament_profiles.py`

## Prerequisites

1. Backend dependencies installed
2. PostgreSQL running
3. Migrations applied:

```bash
alembic upgrade head
```

If you already imported older data before this update, make sure you are on revision
`0002_case_number_non_unique` so shared petition/case numbers can exist across multiple politicians.

## Recommended Workflow

1. Fetch raw records from Wikidata and export for review:

```bash
python scripts/import_real_data.py \
  --source wikidata \
  --limit 1500 \
  --strict-political \
  --include-history \
  --export-file data/raw/wikidata_politicians.json \
  --dry-run
```

2. Curate reviewed politicians JSON (remove noise, add county/position corrections).
3. Scrape parliamentary detail profiles (Mzalendo + Parliament), export to JSON:

```bash
python scripts/scrape_parliament_profiles.py \
  --source both \
  --seed-file data/curated/politicians.json \
  --discover \
  --output-file data/raw/parliamentary_profiles_scraped.json \
  --failed-file data/raw/parliamentary_profiles_failed.json
```

4. Review and curate scraped profile output into `data/curated/parliamentary_profiles.json`.
5. Prepare `cases.csv` and `promises.csv` from verified sources.
6. Run final import:

```bash
python scripts/import_real_data.py \
  --source json \
  --politicians-file data/curated/politicians.json \
  --parliament-profiles-file data/curated/parliamentary_profiles.json \
  --cases-file data/curated/cases.csv \
  --promises-file data/curated/promises.csv
```

7. Recalculate transparency/confidence scores from imported evidence:

```bash
python scripts/recalculate_scores.py --dry-run
python scripts/recalculate_scores.py
```

## File Templates

Use these starter templates:
- `data/templates/politicians_template.json`
- `data/templates/parliamentary_profiles_template.json`
- `data/templates/cases_template.csv`
- `data/templates/promises_template.csv`

## Data Quality Rules

- Politicians:
  - Required: `name`, `position`
  - Match/update by normalized name
  - Optional detailed parliamentary fields:
    - `constituency`, `parliamentary_role`, `parliamentary_profile_url`
    - `parliamentary_profile.current_positions`
    - `parliamentary_profile.committee_memberships`
    - `parliamentary_profile.parliamentary_activity`
    - `parliamentary_profile.recent_contributions`
    - `parliamentary_profile.voting_history`
  - Optional: `history`, `date_of_death`
  - If `photo_url` is missing, importer assigns a default avatar URL
  - County is normalized to Kenyan county names and can be derived from profile text
- Cases:
  - Required: `politician_name`, `title`, `status`
  - `case_number` is optional and can repeat across different politicians for shared petitions
  - Valid status: `pending`, `ongoing`, `resolved`, `dismissed`, `appealed`
  - Valid severity: `low`, `medium`, `high`, `critical` (optional)
- Promises:
  - Required: `politician_name`, `title`, `description`, `date_made`, `status`
  - Valid status: `pending`, `in_progress`, `fulfilled`, `broken`, `partially_fulfilled`

## Notes

- Use `--dry-run` first for every batch.
- Keep source links in `source_urls` / `verification_sources` for auditability.
- For high-confidence production loads, curate JSON/CSV manually after fetch instead of direct auto-import from Wikidata.
- Use `--strict-political` when fetching from Wikidata to reduce non-political roles.
- `--include-history` attempts Wikipedia summary enrichment; if Wikipedia returns `403`, importer auto-disables it and keeps using Wikidata `bio` text.
- The scraper supports direct ingestion with `--ingest`:

```bash
python scripts/scrape_parliament_profiles.py \
  --source both \
  --seed-file data/curated/politicians.json \
  --discover \
  --ingest
```
