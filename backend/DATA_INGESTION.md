# Data Ingestion Guide

This project now includes a real-data import pipeline for MVP Phase 1.

## What It Does

The importer can:
- Fetch politician records from Wikidata
- Import politician records from local JSON
- Import legal cases from CSV
- Import promises from CSV
- Upsert existing rows instead of creating duplicates

Script location:
- `scripts/import_real_data.py`

## Prerequisites

1. Backend dependencies installed
2. PostgreSQL running
3. Migrations applied:

```bash
alembic upgrade head
```

## Recommended Workflow

1. Fetch raw records from Wikidata and export for review:

```bash
python scripts/import_real_data.py \
  --source wikidata \
  --limit 200 \
  --strict-political \
  --export-file data/raw/wikidata_politicians.json \
  --dry-run
```

2. Curate reviewed politicians JSON (remove noise, add county/position corrections).
3. Prepare `cases.csv` and `promises.csv` from verified sources.
4. Run final import:

```bash
python scripts/import_real_data.py \
  --source json \
  --politicians-file data/curated/politicians.json \
  --cases-file data/curated/cases.csv \
  --promises-file data/curated/promises.csv
```

5. Recalculate transparency/confidence scores from imported evidence:

```bash
python scripts/recalculate_scores.py --dry-run
python scripts/recalculate_scores.py
```

## File Templates

Use these starter templates:
- `data/templates/politicians_template.json`
- `data/templates/cases_template.csv`
- `data/templates/promises_template.csv`

## Data Quality Rules

- Politicians:
  - Required: `name`, `position`
  - Match/update by normalized name
- Cases:
  - Required: `politician_name`, `title`, `status`
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
