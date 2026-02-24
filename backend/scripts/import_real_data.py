#!/usr/bin/env python3
"""
Import real data into the Kenya ni Yetu backend database.

Supports:
1) Fetching politicians from Wikidata (SPARQL)
2) Importing politicians from local JSON
3) Importing cases/promises from local CSV

Examples:
    python scripts/import_real_data.py --source wikidata --limit 150 --export-file data/raw/wikidata_politicians.json
    python scripts/import_real_data.py --source json --politicians-file data/templates/politicians_template.json --dry-run
    python scripts/import_real_data.py --source json --politicians-file data/curated/politicians.json --cases-file data/curated/cases.csv --promises-file data/curated/promises.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.database import SessionLocal  # noqa: E402
from app.models.case import CaseSeverity, CaseStatus, LegalCase  # noqa: E402
from app.models.politician import Politician  # noqa: E402
from app.models.promise import Promise, PromiseStatus  # noqa: E402


logger = logging.getLogger("import_real_data")


@dataclass
class ImportStats:
    politicians_created: int = 0
    politicians_updated: int = 0
    cases_created: int = 0
    cases_updated: int = 0
    promises_created: int = 0
    promises_updated: int = 0
    skipped_rows: int = 0


def configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(message)s")


def normalize_name(name: str) -> str:
    return " ".join(name.strip().split()).lower()


def parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None

    cleaned = value.strip()
    if not cleaned:
        return None

    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue

    try:
        return date.fromisoformat(cleaned)
    except ValueError:
        return None


class RealDataImporter:
    WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"
    POLITICAL_POSITION_KEYWORDS = [
        "president",
        "deputy president",
        "prime minister",
        "cabinet secretary",
        "member of the national assembly",
        "member of parliament",
        "senator",
        "governor",
        "deputy governor",
        "member of county assembly",
        "county assembly",
        "speaker",
        "minister",
    ]
    EXCLUDED_POSITION_KEYWORDS = [
        "bishop",
        "archbishop",
        "cardinal",
        "priest",
        "pastor",
        "imam",
        "rabbi",
        "reverend",
    ]

    @staticmethod
    def is_political_position(position: str) -> bool:
        p = position.strip().lower()
        if not p:
            return False
        if any(excluded in p for excluded in RealDataImporter.EXCLUDED_POSITION_KEYWORDS):
            return False
        return any(keyword in p for keyword in RealDataImporter.POLITICAL_POSITION_KEYWORDS)

    @staticmethod
    def fetch_politicians_from_wikidata(limit: int, strict_political: bool = False) -> List[Dict[str, Any]]:
        """
        Fetch Kenyan politicians from Wikidata.
        """
        import httpx

        query = f"""
        SELECT ?item ?itemLabel ?positionLabel ?partyLabel ?image ?dob WHERE {{
          ?item wdt:P31 wd:Q5;
                wdt:P27 wd:Q114;
                p:P39 ?positionStatement.
          ?positionStatement ps:P39 ?position.

          FILTER NOT EXISTS {{ ?positionStatement pq:P582 ?endDate. }}

          OPTIONAL {{ ?item wdt:P102 ?party. }}
          OPTIONAL {{ ?item wdt:P18 ?image. }}
          OPTIONAL {{ ?item wdt:P569 ?dob. }}

          SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
        }}
        LIMIT {int(limit)}
        """

        headers = {
            "Accept": "application/sparql-results+json",
            "User-Agent": "kenya-ni-yetu-data-importer/1.0 (contact: developers@kenyaniyetu.org)",
        }

        response = httpx.get(
            RealDataImporter.WIKIDATA_ENDPOINT,
            params={"query": query, "format": "json"},
            headers=headers,
            timeout=60.0,
        )
        response.raise_for_status()

        payload = response.json()
        rows = payload.get("results", {}).get("bindings", [])

        deduped: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            name = row.get("itemLabel", {}).get("value", "").strip()
            position = row.get("positionLabel", {}).get("value", "").strip()
            if not name or not position:
                continue
            if strict_political and not RealDataImporter.is_political_position(position):
                continue

            key = normalize_name(name)
            if key in deduped:
                continue

            dob = row.get("dob", {}).get("value")
            deduped[key] = {
                "name": name,
                "position": position,
                "party": row.get("partyLabel", {}).get("value"),
                "photo_url": row.get("image", {}).get("value"),
                "date_of_birth": parse_date(dob[:10]) if dob else None,
                "bio": None,
                "county": None,
            }

        logger.info("Fetched %s unique politician records from Wikidata.", len(deduped))
        return list(deduped.values())

    @staticmethod
    def load_politicians_from_json(file_path: Path) -> List[Dict[str, Any]]:
        with file_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, list):
            raise ValueError("Politicians JSON must be a list of objects.")

        records: List[Dict[str, Any]] = []
        for item in data:
            if not isinstance(item, dict):
                continue
            records.append(item)

        logger.info("Loaded %s politician records from %s", len(records), file_path)
        return records

    @staticmethod
    def upsert_politicians(db: Session, records: List[Dict[str, Any]], stats: ImportStats) -> Dict[str, str]:
        existing = {
            normalize_name(p.name): p
            for p in db.query(Politician).all()
        }
        name_to_id: Dict[str, str] = {}

        for rec in records:
            name = (rec.get("name") or "").strip()
            position = (rec.get("position") or "").strip()
            if not name or not position:
                stats.skipped_rows += 1
                continue

            key = normalize_name(name)
            politician = existing.get(key)
            date_of_birth = rec.get("date_of_birth")
            if isinstance(date_of_birth, str):
                date_of_birth = parse_date(date_of_birth)

            if politician is None:
                politician = Politician(
                    name=name,
                    position=position,
                    party=rec.get("party"),
                    county=rec.get("county"),
                    photo_url=rec.get("photo_url"),
                    bio=rec.get("bio"),
                    date_of_birth=date_of_birth,
                    education=rec.get("education"),
                    contact_info=rec.get("contact_info"),
                    social_media=rec.get("social_media"),
                    transparency_score=rec.get("transparency_score", 0),
                    confidence_level=rec.get("confidence_level", 0),
                    is_active=bool(rec.get("is_active", True)),
                )
                db.add(politician)
                db.flush()
                existing[key] = politician
                stats.politicians_created += 1
            else:
                updated = False
                updates = {
                    "position": position,
                    "party": rec.get("party"),
                    "county": rec.get("county"),
                    "photo_url": rec.get("photo_url"),
                    "bio": rec.get("bio"),
                    "date_of_birth": date_of_birth,
                    "education": rec.get("education"),
                    "contact_info": rec.get("contact_info"),
                    "social_media": rec.get("social_media"),
                }
                for field, value in updates.items():
                    if value and getattr(politician, field) != value:
                        setattr(politician, field, value)
                        updated = True

                # Explicitly support score/status updates, including zero values.
                if "transparency_score" in rec:
                    score_value = rec.get("transparency_score")
                    if score_value is not None and politician.transparency_score != score_value:
                        politician.transparency_score = score_value
                        updated = True

                if "confidence_level" in rec:
                    confidence_value = rec.get("confidence_level")
                    if confidence_value is not None and politician.confidence_level != confidence_value:
                        politician.confidence_level = confidence_value
                        updated = True

                if "is_active" in rec:
                    is_active_value = bool(rec.get("is_active"))
                    if politician.is_active != is_active_value:
                        politician.is_active = is_active_value
                        updated = True
                if updated:
                    stats.politicians_updated += 1

            name_to_id[key] = str(politician.id)

        return name_to_id

    @staticmethod
    def import_cases_from_csv(
        db: Session,
        csv_path: Path,
        politician_map: Dict[str, str],
        stats: ImportStats,
    ) -> None:
        existing_cases_with_number = db.query(LegalCase).filter(LegalCase.case_number.isnot(None)).all()
        case_number_owner: Dict[str, str] = {
            case.case_number: str(case.politician_id)
            for case in existing_cases_with_number
            if case.case_number
        }

        with csv_path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                politician_name = (row.get("politician_name") or "").strip()
                title = (row.get("title") or "").strip()
                status_raw = (row.get("status") or "").strip().lower()

                if not politician_name or not title or not status_raw:
                    stats.skipped_rows += 1
                    continue

                politician_id = politician_map.get(normalize_name(politician_name))
                if not politician_id:
                    logger.warning("Skipping case '%s': politician '%s' not found.", title, politician_name)
                    stats.skipped_rows += 1
                    continue

                try:
                    status = CaseStatus(status_raw)
                except ValueError:
                    logger.warning("Skipping case '%s': invalid status '%s'.", title, status_raw)
                    stats.skipped_rows += 1
                    continue

                incoming_case_number = (row.get("case_number") or "").strip() or None
                if incoming_case_number:
                    owner_politician_id = case_number_owner.get(incoming_case_number)
                    if owner_politician_id and owner_politician_id != politician_id:
                        logger.warning(
                            "Case number '%s' already belongs to another politician; setting case_number=NULL for '%s' (%s).",
                            incoming_case_number,
                            title,
                            politician_name,
                        )
                        incoming_case_number = None

                severity_raw = (row.get("severity") or "").strip().lower()
                severity = None
                if severity_raw:
                    try:
                        severity = CaseSeverity(severity_raw)
                    except ValueError:
                        logger.warning("Invalid case severity '%s' for '%s'. Ignoring severity.", severity_raw, title)

                case = None
                if incoming_case_number:
                    case = db.query(LegalCase).filter(
                        LegalCase.case_number == incoming_case_number
                    ).first()

                if case is None:
                    case = db.query(LegalCase).filter(
                        LegalCase.politician_id == politician_id,
                        func.lower(LegalCase.title) == title.lower(),
                    ).first()

                if case is None:
                    case = LegalCase(
                        politician_id=politician_id,
                        title=title,
                        status=status,
                    )
                    db.add(case)
                    stats.cases_created += 1
                else:
                    stats.cases_updated += 1

                source_urls_raw = (row.get("source_urls") or "").strip()
                source_urls = [u.strip() for u in source_urls_raw.split("|") if u.strip()] if source_urls_raw else None

                case.case_number = incoming_case_number
                case.court = (row.get("court") or "").strip() or None
                case.status = status
                case.date_filed = parse_date(row.get("date_filed"))
                case.date_resolved = parse_date(row.get("date_resolved"))
                case.severity = severity
                case.category = (row.get("category") or "").strip() or None
                case.description = (row.get("description") or "").strip() or None
                case.outcome = (row.get("outcome") or "").strip() or None
                case.source_urls = source_urls

                impact_score_raw = (row.get("impact_score") or "").strip()
                case.impact_score = float(impact_score_raw) if impact_score_raw else None

                if case.case_number:
                    case_number_owner[case.case_number] = str(case.politician_id)

    @staticmethod
    def import_promises_from_csv(
        db: Session,
        csv_path: Path,
        politician_map: Dict[str, str],
        stats: ImportStats,
    ) -> None:
        with csv_path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                politician_name = (row.get("politician_name") or "").strip()
                title = (row.get("title") or "").strip()
                description = (row.get("description") or "").strip()
                status_raw = (row.get("status") or "").strip().lower()
                date_made = parse_date(row.get("date_made"))

                if not politician_name or not title or not description or not status_raw or not date_made:
                    stats.skipped_rows += 1
                    continue

                politician_id = politician_map.get(normalize_name(politician_name))
                if not politician_id:
                    logger.warning("Skipping promise '%s': politician '%s' not found.", title, politician_name)
                    stats.skipped_rows += 1
                    continue

                try:
                    status = PromiseStatus(status_raw)
                except ValueError:
                    logger.warning("Skipping promise '%s': invalid status '%s'.", title, status_raw)
                    stats.skipped_rows += 1
                    continue

                promise = db.query(Promise).filter(
                    Promise.politician_id == politician_id,
                    func.lower(Promise.title) == title.lower(),
                ).first()

                if promise is None:
                    promise = Promise(
                        politician_id=politician_id,
                        title=title,
                        description=description,
                        date_made=date_made,
                        status=status,
                    )
                    db.add(promise)
                    stats.promises_created += 1
                else:
                    stats.promises_updated += 1

                verification_sources_raw = (row.get("verification_sources") or "").strip()
                verification_sources = (
                    [u.strip() for u in verification_sources_raw.split("|") if u.strip()]
                    if verification_sources_raw
                    else None
                )

                fulfillment_raw = (row.get("fulfillment_percentage") or "0").strip()
                try:
                    fulfillment_percentage = int(fulfillment_raw)
                except ValueError:
                    fulfillment_percentage = 0

                promise.description = description
                promise.date_made = date_made
                promise.deadline = parse_date(row.get("deadline"))
                promise.status = status
                promise.category = (row.get("category") or "").strip() or None
                promise.fulfillment_percentage = max(0, min(100, fulfillment_percentage))
                promise.verification_sources = verification_sources
                promise.impact_area = (row.get("impact_area") or "").strip() or None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import real data into Kenya ni Yetu backend")
    parser.add_argument("--source", choices=["wikidata", "json"], required=True)
    parser.add_argument("--politicians-file", type=Path, help="Path to politicians JSON file (required for --source json)")
    parser.add_argument("--cases-file", type=Path, help="Optional path to legal cases CSV")
    parser.add_argument("--promises-file", type=Path, help="Optional path to promises CSV")
    parser.add_argument("--limit", type=int, default=150, help="Wikidata fetch limit")
    parser.add_argument(
        "--strict-political",
        action="store_true",
        help="Filter Wikidata rows to likely political offices and exclude religious roles",
    )
    parser.add_argument("--export-file", type=Path, help="Optional path to export fetched politician records as JSON")
    parser.add_argument("--dry-run", action="store_true", help="Run import without committing changes")
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    configure_logging(args.verbose)

    importer = RealDataImporter()
    stats = ImportStats()

    if args.source == "json":
        if not args.politicians_file:
            logger.error("--politicians-file is required when --source json")
            return 2
        politicians = importer.load_politicians_from_json(args.politicians_file)
    else:
        politicians = importer.fetch_politicians_from_wikidata(args.limit, strict_political=args.strict_political)

    if args.export_file:
        args.export_file.parent.mkdir(parents=True, exist_ok=True)
        with args.export_file.open("w", encoding="utf-8") as f:
            json.dump(politicians, f, ensure_ascii=False, indent=2, default=str)
        logger.info("Exported fetched data to %s", args.export_file)

    with SessionLocal() as db:
        try:
            politician_map = importer.upsert_politicians(db, politicians, stats)

            if args.cases_file:
                importer.import_cases_from_csv(db, args.cases_file, politician_map, stats)

            if args.promises_file:
                importer.import_promises_from_csv(db, args.promises_file, politician_map, stats)

            if args.dry_run:
                db.rollback()
                logger.info("Dry run complete. No changes committed.")
            else:
                db.commit()
                logger.info("Import committed successfully.")
        except Exception:
            db.rollback()
            logger.exception("Import failed, transaction rolled back.")
            return 1

    logger.info(
        "Import summary: politicians created=%s updated=%s, cases created=%s updated=%s, promises created=%s updated=%s, skipped=%s",
        stats.politicians_created,
        stats.politicians_updated,
        stats.cases_created,
        stats.cases_updated,
        stats.promises_created,
        stats.promises_updated,
        stats.skipped_rows,
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
