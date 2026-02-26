#!/usr/bin/env python3
"""
Scrape Kenyan parliamentary profile data and optionally ingest it.

Supported sources:
- mzalendo.com
- parliament.go.ke

Outputs records compatible with:
    scripts/import_real_data.py --parliament-profiles-file
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from slugify import slugify


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

logger = logging.getLogger("scrape_parliament_profiles")

DEFAULT_OUTPUT_FILE = ROOT_DIR / "data" / "raw" / "parliamentary_profiles_scraped.json"
DEFAULT_SEED_FILE = ROOT_DIR / "data" / "curated" / "politicians.json"

DEFAULT_MZALENDO_INDEX_URLS = [
    "https://mzalendo.com/parliament/",
]
DEFAULT_PARLIAMENT_INDEX_URLS = [
    "https://www.parliament.go.ke/the-national-assembly/mps/current",
    "https://www.parliament.go.ke/the-senate/senators",
]

PARLIAMENT_SECTION_HEADINGS = [
    "parties and coalitions",
    "current positions",
    "committee membership",
    "committee memberships",
    "parliamentary activity",
    "legislative contributions",
    "voting patterns",
    "voting history",
    "statements",
    "questions & answers",
    "parliamentary procedures",
    "motions",
]

CONTRIBUTION_CATEGORIES = {
    "statements",
    "questions & answers",
    "parliamentary procedures",
    "motions",
}
VOTE_DECISIONS = {"yes", "no", "absent", "abstain", "present"}

KENYAN_COUNTY_NAMES = [
    "Baringo",
    "Bomet",
    "Bungoma",
    "Busia",
    "Elgeyo-Marakwet",
    "Embu",
    "Garissa",
    "Homa Bay",
    "Isiolo",
    "Kajiado",
    "Kakamega",
    "Kericho",
    "Kiambu",
    "Kilifi",
    "Kirinyaga",
    "Kisii",
    "Kisumu",
    "Kitui",
    "Kwale",
    "Laikipia",
    "Lamu",
    "Machakos",
    "Makueni",
    "Mandera",
    "Marsabit",
    "Meru",
    "Migori",
    "Mombasa",
    "Murang'a",
    "Nairobi",
    "Nakuru",
    "Nandi",
    "Narok",
    "Nyamira",
    "Nyandarua",
    "Nyeri",
    "Samburu",
    "Siaya",
    "Taita-Taveta",
    "Tana River",
    "Tharaka-Nithi",
    "Trans Nzoia",
    "Turkana",
    "Uasin Gishu",
    "Vihiga",
    "Wajir",
    "West Pokot",
]
KENYAN_COUNTIES = {name.lower(): name for name in KENYAN_COUNTY_NAMES}


@dataclass
class ScrapeStats:
    urls_total: int = 0
    urls_succeeded: int = 0
    urls_failed: int = 0
    records_built: int = 0


def configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(message)s")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape parliamentary profile data from Mzalendo/Parliament and ingest it")
    parser.add_argument(
        "--source",
        choices=["mzalendo", "parliament", "both"],
        default="both",
        help="Source(s) to scrape",
    )
    parser.add_argument(
        "--seed-file",
        type=Path,
        default=DEFAULT_SEED_FILE,
        help="Optional politicians JSON used for URL seeds and fallback metadata",
    )
    parser.add_argument(
        "--profile-url",
        action="append",
        default=[],
        help="Explicit profile URL (repeatable)",
    )
    parser.add_argument(
        "--index-url",
        action="append",
        default=[],
        help="Index/listing URL to crawl for profile links (repeatable)",
    )
    parser.add_argument(
        "--discover",
        action="store_true",
        help="Discover profile links from default index pages for the selected source(s)",
    )
    parser.add_argument(
        "--guess-mzalendo-slugs",
        action="store_true",
        help="Generate likely Mzalendo profile URLs from seed-file names if missing",
    )
    parser.add_argument("--limit", type=int, default=0, help="Optional cap on profile URLs to scrape (0 means all)")
    parser.add_argument(
        "--max-contributions",
        type=int,
        default=20,
        help="Maximum recent contributions captured per profile",
    )
    parser.add_argument("--output-file", type=Path, default=DEFAULT_OUTPUT_FILE, help="Path to output JSON")
    parser.add_argument("--failed-file", type=Path, help="Optional path to store failed URLs with errors")
    parser.add_argument("--timeout", type=float, default=25.0, help="HTTP request timeout seconds")
    parser.add_argument("--ingest", action="store_true", help="Ingest scraped records into DB after scraping")
    parser.add_argument("--dry-run", action="store_true", help="When used with --ingest, rollback DB changes")
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def parse_human_date(value: str) -> Optional[date]:
    if not value:
        return None
    cleaned = re.sub(r"\s+", " ", value).strip()
    cleaned = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", cleaned, flags=re.IGNORECASE)
    for fmt in ("%Y-%m-%d", "%d %B %Y", "%B %d, %Y", "%d %b %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def normalize_name(value: str) -> str:
    return normalize_text(value).lower()


def normalize_constituency(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = normalize_text(value)
    if not cleaned:
        return None
    return re.sub(r"\s+constituency$", "", cleaned, flags=re.IGNORECASE)


def normalize_county(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = normalize_text(value)
    if not cleaned:
        return None

    lowered = cleaned.lower().replace(" county", "").replace(" county government", "").strip()
    canonical = KENYAN_COUNTIES.get(lowered)
    if not canonical:
        return None
    return canonical


def compact_lines(text: str) -> List[str]:
    lines: List[str] = []
    previous = None
    for raw in text.splitlines():
        line = normalize_text(raw)
        if not line:
            continue
        if line == previous:
            continue
        lines.append(line)
        previous = line
    return lines


def is_section_heading(line: str) -> bool:
    lowered = line.lower().strip(":")
    if lowered in PARLIAMENT_SECTION_HEADINGS:
        return True
    if lowered.startswith("more ") and lowered.endswith(" information"):
        return True
    if re.fullmatch(r"[A-Z][A-Z &/-]{5,}", line):
        return True
    return False


def extract_section(lines: Sequence[str], heading: str, max_lines: int = 160) -> List[str]:
    heading_lower = heading.lower()
    for idx, line in enumerate(lines):
        if line.lower().strip(":") != heading_lower:
            continue
        out: List[str] = []
        for candidate in lines[idx + 1 : idx + 1 + max_lines]:
            if is_section_heading(candidate):
                break
            out.append(candidate)
        return out
    return []


def parse_speech_session(value: str) -> tuple[Optional[int], Optional[int]]:
    m = re.search(r"(\d+)\s+speech(?:es)?\s+in\s+(\d+)\s+contribution", value, flags=re.IGNORECASE)
    if not m:
        return None, None
    return int(m.group(1)), int(m.group(2))


def parse_current_positions(lines: Sequence[str]) -> List[Dict[str, Optional[str]]]:
    positions: List[Dict[str, Optional[str]]] = []
    for line in lines:
        m = re.search(r"(.+?)\s+from\s+(.+?)\s+to\s+(.+)$", line, flags=re.IGNORECASE)
        if not m:
            continue
        start = parse_human_date(m.group(2))
        end_raw = m.group(3).strip()
        end = None if end_raw.lower() in {"present", "to date", "now"} else parse_human_date(end_raw)
        positions.append(
            {
                "title": normalize_text(m.group(1)),
                "start_date": start.isoformat() if start else None,
                "end_date": end.isoformat() if end else None,
            }
        )
    if not positions and lines:
        positions.append({"title": normalize_text(lines[0]), "start_date": None, "end_date": None})
    return positions


def parse_committee_memberships(lines: Sequence[str]) -> List[str]:
    committees: List[str] = []
    seen: Set[str] = set()
    for line in lines:
        m = re.search(r"member of the\s+(.+?)\s+committee", line, flags=re.IGNORECASE)
        if m:
            committee = normalize_text(m.group(1)).title()
        elif "committee" in line.lower():
            committee = normalize_text(re.sub(r"\s*committee\.?$", "", line, flags=re.IGNORECASE)).title()
        else:
            continue
        key = committee.lower()
        if key and key not in seen:
            committees.append(committee)
            seen.add(key)
    return committees


def parse_parliamentary_activity(lines: Sequence[str], page_text: str) -> Dict[str, int]:
    activity: Dict[str, int] = {}
    blob = " ".join(lines) if lines else page_text

    speeches_match = re.search(
        r"has made\s+(\d+)\s+speeches\s+last year\s+and a total of\s+(\d+)\s+speeches",
        blob,
        flags=re.IGNORECASE,
    )
    if speeches_match:
        activity["speeches_last_year"] = int(speeches_match.group(1))
        activity["total_speeches"] = int(speeches_match.group(2))
    else:
        last_year_match = re.search(r"(\d+)\s+speeches\s+last year", blob, flags=re.IGNORECASE)
        total_match = re.search(r"total of\s+(\d+)\s+speeches", blob, flags=re.IGNORECASE)
        if last_year_match:
            activity["speeches_last_year"] = int(last_year_match.group(1))
        if total_match:
            activity["total_speeches"] = int(total_match.group(1))

    if re.search(r"has not sponsored any bill", blob, flags=re.IGNORECASE):
        activity["bills_sponsored"] = 0
    else:
        sponsored_match = re.search(r"has sponsored\s+(\d+)\s+bill", blob, flags=re.IGNORECASE)
        if sponsored_match:
            activity["bills_sponsored"] = int(sponsored_match.group(1))

    return activity


def parse_recent_contributions(lines: Sequence[str], max_items: int) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    for idx, line in enumerate(lines):
        category = line.lower()
        if category not in CONTRIBUTION_CATEGORIES:
            continue
        if idx + 2 >= len(lines):
            continue

        event_date = parse_human_date(lines[idx + 1])
        if not event_date:
            continue

        session_line = lines[idx + 2]
        speech_count, contribution_count = parse_speech_session(session_line)
        if speech_count is None or contribution_count is None:
            continue

        subtype = lines[idx + 3] if idx + 3 < len(lines) else None
        title = lines[idx + 4] if idx + 4 < len(lines) else None
        excerpt = lines[idx + 5] if idx + 5 < len(lines) else None

        key = f"{event_date.isoformat()}::{(title or '').lower()}::{category}"
        if key in seen:
            continue
        seen.add(key)

        rows.append(
            {
                "category": line,
                "date": event_date.isoformat(),
                "title": normalize_text(title or ""),
                "subtype": normalize_text(subtype or ""),
                "session": normalize_text(session_line),
                "speech_count": speech_count,
                "contribution_count": contribution_count,
                "excerpt": normalize_text(excerpt or ""),
            }
        )

        if len(rows) >= max_items:
            break

    return rows


def parse_voting_history_from_table(soup: BeautifulSoup) -> List[Dict[str, str]]:
    votes: List[Dict[str, str]] = []
    seen: Set[str] = set()
    for table in soup.find_all("table"):
        headers = [normalize_text(h.get_text(" ", strip=True)).lower() for h in table.find_all(["th", "td"])[:6]]
        if not headers:
            continue
        header_blob = " ".join(headers)
        if "date" not in header_blob or "decision" not in header_blob:
            continue

        for tr in table.find_all("tr"):
            cols = [normalize_text(c.get_text(" ", strip=True)) for c in tr.find_all(["td", "th"])]
            if len(cols) < 3:
                continue
            parsed_date = parse_human_date(cols[0])
            decision = cols[-1]
            if not parsed_date or decision.lower() not in VOTE_DECISIONS:
                continue
            motion = cols[1]
            key = f"{parsed_date.isoformat()}::{motion.lower()}::{decision.lower()}"
            if key in seen:
                continue
            seen.add(key)
            votes.append({"date": parsed_date.isoformat(), "motion": motion, "decision": decision})
    return votes


def parse_voting_history_from_lines(lines: Sequence[str]) -> List[Dict[str, str]]:
    votes: List[Dict[str, str]] = []
    seen: Set[str] = set()
    for idx, line in enumerate(lines):
        parsed_date = parse_human_date(line)
        if not parsed_date:
            continue
        if idx + 2 >= len(lines):
            continue
        motion = lines[idx + 1]
        decision = lines[idx + 2]
        if decision.lower() not in VOTE_DECISIONS:
            continue
        key = f"{parsed_date.isoformat()}::{motion.lower()}::{decision.lower()}"
        if key in seen:
            continue
        seen.add(key)
        votes.append({"date": parsed_date.isoformat(), "motion": normalize_text(motion), "decision": normalize_text(decision)})
    return votes


def find_meta_content(soup: BeautifulSoup, name: str, key: str) -> Optional[str]:
    tag = soup.find("meta", attrs={name: key}) or soup.find("meta", attrs={"property": key})
    if not tag:
        return None
    content = tag.get("content")
    if not isinstance(content, str):
        return None
    content = normalize_text(content)
    return content or None


def extract_name(soup: BeautifulSoup, fallback: Optional[str]) -> Optional[str]:
    for selector in ("h1", "h2"):
        tag = soup.find(selector)
        if not tag:
            continue
        candidate = normalize_text(tag.get_text(" ", strip=True))
        if not candidate:
            continue
        if len(candidate.split()) >= 2 and not re.search(r"mzalendo|parliament|kenya", candidate, flags=re.IGNORECASE):
            return candidate

    og_title = find_meta_content(soup, "property", "og:title")
    if og_title:
        og_title = re.sub(r"\s*[-|]\s*Mzalendo.*$", "", og_title, flags=re.IGNORECASE)
        if len(og_title.split()) >= 2:
            return normalize_text(og_title)

    if fallback:
        return fallback
    return None


def extract_party(lines: Sequence[str]) -> Optional[str]:
    section = extract_section(lines, "parties and coalitions", max_lines=12)
    for line in section:
        if line.lower().startswith("more "):
            continue
        return line
    return None


def extract_role_and_position(lines: Sequence[str], fallback_position: Optional[str]) -> tuple[Optional[str], str]:
    parliamentary_role = None
    position = fallback_position or "Member of Parliament"

    role_re = re.compile(r"^(elected|nominated)\s*-\s*(constituency|senate|women representative|special seat)", re.IGNORECASE)
    for line in lines[:40]:
        m = role_re.search(line)
        if m:
            parliamentary_role = slugify(f"{m.group(1)}_{m.group(2)}", separator="_")
            break

    for line in lines[:80]:
        lowered = line.lower()
        if lowered.startswith("mna for"):
            position = "Member of the National Assembly"
            break
        if lowered.startswith("senator for"):
            position = "Senator"
            break
        if lowered.startswith("woman representative for"):
            position = "Woman Representative"
            break

    return parliamentary_role, position


def extract_constituency(lines: Sequence[str], fallback: Optional[str]) -> Optional[str]:
    patterns = [
        re.compile(r"mna for\s+(.+)$", re.IGNORECASE),
        re.compile(r"senator for\s+(.+)$", re.IGNORECASE),
        re.compile(r"woman representative for\s+(.+)$", re.IGNORECASE),
        re.compile(r"member of parliament for\s+(.+?)(?:,|$)", re.IGNORECASE),
        re.compile(r"for\s+(.+?)\s+constituency", re.IGNORECASE),
    ]
    for line in lines[:200]:
        for pattern in patterns:
            m = pattern.search(line)
            if not m:
                continue
            candidate = normalize_constituency(m.group(1))
            if candidate:
                return candidate
    return normalize_constituency(fallback) if fallback else None


def extract_county(lines: Sequence[str], fallback: Optional[str]) -> Optional[str]:
    if fallback:
        county = normalize_county(fallback)
        if county:
            return county

    joined = " ".join(lines[:300])
    m = re.search(r"([A-Za-z' -]+?)\s+County", joined, flags=re.IGNORECASE)
    if m:
        county = normalize_county(m.group(1))
        if county:
            return county
    return None


def build_history(name: str, position: str, constituency: Optional[str], county: Optional[str], party: Optional[str]) -> str:
    constituency_part = f" for {constituency} Constituency" if constituency else ""
    county_part = f" in {county} County" if county else ""
    party_part = f" under {party}" if party else ""
    return f"{name} serves as {position}{constituency_part}{county_part}{party_part}.".strip()


def is_supported_profile_url(url: str, source: str) -> bool:
    host = urlparse(url).netloc.lower()
    if source == "mzalendo":
        return "mzalendo.com" in host
    if source == "parliament":
        return "parliament.go.ke" in host
    return "mzalendo.com" in host or "parliament.go.ke" in host


def extract_profile_links_from_index(url: str, html: str, source: str) -> List[str]:
    soup = BeautifulSoup(html, "lxml")
    links: Set[str] = set()

    for tag in soup.find_all("a", href=True):
        href = normalize_text(tag["href"])
        if not href:
            continue
        absolute = urljoin(url, href)
        parsed = urlparse(absolute)
        if parsed.scheme not in {"http", "https"}:
            continue
        host = parsed.netloc.lower()
        path = parsed.path.lower().rstrip("/")

        if source in {"mzalendo", "both"} and "mzalendo.com" in host and "/parliament/politician/" in path:
            links.add(absolute)
            continue

        if source in {"parliament", "both"} and "parliament.go.ke" in host:
            if any(token in path for token in ["/member/", "/members/", "/mp/", "/mps/", "/senator/", "/senators/"]):
                links.add(absolute)

    return sorted(links)


def scrape_profile(url: str, html: str, seed: Optional[Dict[str, Any]], max_contributions: int) -> Dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    lines = compact_lines(soup.get_text("\n", strip=True))
    page_text = " ".join(lines)

    fallback_name = (seed or {}).get("name")
    name = extract_name(soup, fallback=fallback_name)
    if not name:
        raise ValueError("Could not extract politician name")

    party = extract_party(lines) or (seed or {}).get("party")
    parliamentary_role, position = extract_role_and_position(lines, fallback_position=(seed or {}).get("position"))
    constituency = extract_constituency(lines, fallback=(seed or {}).get("constituency"))
    county = extract_county(lines, fallback=(seed or {}).get("county"))

    current_positions = parse_current_positions(extract_section(lines, "current positions"))
    committees = parse_committee_memberships(extract_section(lines, "committee membership") + extract_section(lines, "committee memberships"))
    activity = parse_parliamentary_activity(extract_section(lines, "parliamentary activity"), page_text=page_text)
    contributions = parse_recent_contributions(lines, max_items=max_contributions)
    voting_history = parse_voting_history_from_table(soup)
    if not voting_history:
        voting_lines = extract_section(lines, "voting patterns", max_lines=220)
        if not voting_lines:
            voting_lines = extract_section(lines, "voting history", max_lines=220)
        voting_history = parse_voting_history_from_lines(voting_lines)

    parliamentary_profile = {
        "current_positions": current_positions,
        "committee_memberships": committees,
        "parliamentary_activity": activity,
        "recent_contributions": contributions,
        "voting_history": voting_history,
    }

    bio = find_meta_content(soup, "name", "description") or (seed or {}).get("bio")
    if not bio:
        bio = build_history(name=name, position=position, constituency=constituency, county=county, party=party)

    history = (seed or {}).get("history") or build_history(
        name=name,
        position=position,
        constituency=constituency,
        county=county,
        party=party,
    )

    record: Dict[str, Any] = {
        "name": name,
        "position": position,
        "party": party,
        "county": county,
        "constituency": constituency,
        "parliamentary_role": parliamentary_role or (seed or {}).get("parliamentary_role"),
        "parliamentary_profile_url": url,
        "bio": bio,
        "history": history,
        "parliamentary_profile": parliamentary_profile,
    }

    for key in ("photo_url", "date_of_birth", "date_of_death", "education", "contact_info", "social_media"):
        if seed and seed.get(key):
            record[key] = seed[key]

    return record


def load_seed_records(seed_file: Optional[Path]) -> List[Dict[str, Any]]:
    if not seed_file:
        return []
    if not seed_file.exists():
        logger.warning("Seed file not found: %s", seed_file)
        return []

    with seed_file.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("Seed file must contain a list of politician objects")
    records = [row for row in data if isinstance(row, dict)]
    logger.info("Loaded %s seed politician records from %s", len(records), seed_file)
    return records


def build_seed_indexes(seed_records: Sequence[Dict[str, Any]]) -> tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]]]:
    by_name: Dict[str, Dict[str, Any]] = {}
    by_profile_url: Dict[str, Dict[str, Any]] = {}

    for row in seed_records:
        name = normalize_text(str(row.get("name") or ""))
        if name:
            by_name[normalize_name(name)] = row
        url = normalize_text(str(row.get("parliamentary_profile_url") or ""))
        if url:
            by_profile_url[url.rstrip("/")] = row

    return by_name, by_profile_url


def discover_links(client: httpx.Client, source: str, extra_index_urls: Sequence[str]) -> List[str]:
    urls: List[str] = []
    if source in {"mzalendo", "both"}:
        urls.extend(DEFAULT_MZALENDO_INDEX_URLS)
    if source in {"parliament", "both"}:
        urls.extend(DEFAULT_PARLIAMENT_INDEX_URLS)
    urls.extend(extra_index_urls)

    discovered: Set[str] = set()
    for url in urls:
        try:
            response = client.get(url)
            response.raise_for_status()
        except Exception as exc:
            logger.warning("Failed to crawl index URL %s: %s", url, exc)
            continue
        for link in extract_profile_links_from_index(url, response.text, source=source):
            discovered.add(link.rstrip("/"))

    logger.info("Discovered %s profile URLs from index pages.", len(discovered))
    return sorted(discovered)


def guess_mzalendo_urls(seed_records: Sequence[Dict[str, Any]]) -> List[str]:
    guessed: List[str] = []
    for row in seed_records:
        name = normalize_text(str(row.get("name") or ""))
        if not name:
            continue
        slug = slugify(name)
        if not slug:
            continue
        guessed.append(f"https://mzalendo.com/parliament/politician/{slug}/")
    logger.info("Generated %s guessed Mzalendo profile URLs from names.", len(guessed))
    return guessed


def collect_target_urls(
    source: str,
    seed_records: Sequence[Dict[str, Any]],
    explicit_profile_urls: Sequence[str],
    discovered_urls: Sequence[str],
    include_guessed_mzalendo: bool,
) -> List[str]:
    deduped: Set[str] = set()

    def add_url(raw_url: str) -> None:
        url = normalize_text(raw_url).rstrip("/")
        if not url:
            return
        if not is_supported_profile_url(url, source):
            return
        deduped.add(url)

    for url in explicit_profile_urls:
        add_url(url)

    for row in seed_records:
        profile_url = row.get("parliamentary_profile_url")
        if isinstance(profile_url, str):
            add_url(profile_url)

    for url in discovered_urls:
        add_url(url)

    if include_guessed_mzalendo and source in {"mzalendo", "both"}:
        for url in guess_mzalendo_urls(seed_records):
            add_url(url)

    return sorted(deduped)


def ingest_scraped_records(records: Sequence[Dict[str, Any]], dry_run: bool) -> Dict[str, int]:
    # Lazy imports keep scraping usable even when DB env vars are not set.
    from app.database import SessionLocal
    from import_real_data import ImportStats, RealDataImporter

    importer = RealDataImporter()
    stats = ImportStats()

    with SessionLocal() as db:
        try:
            importer.upsert_politicians(db, list(records), stats)
            if dry_run:
                db.rollback()
                logger.info("Ingest dry run complete. DB transaction rolled back.")
            else:
                db.commit()
                logger.info("Ingest committed successfully.")
        except Exception:
            db.rollback()
            logger.exception("Ingest failed, transaction rolled back.")
            raise

    return {
        "politicians_created": stats.politicians_created,
        "politicians_updated": stats.politicians_updated,
        "skipped_rows": stats.skipped_rows,
    }


def main() -> int:
    args = parse_args()
    configure_logging(args.verbose)

    seed_records = load_seed_records(args.seed_file)
    seed_by_name, seed_by_url = build_seed_indexes(seed_records)

    scrape_stats = ScrapeStats()
    failed: List[Dict[str, str]] = []
    scraped_by_name: Dict[str, Dict[str, Any]] = {}

    transport = httpx.HTTPTransport(retries=2)
    with httpx.Client(
        follow_redirects=True,
        timeout=args.timeout,
        transport=transport,
        headers={
            "User-Agent": "kenya-ni-yetu-parliament-scraper/1.0 (contact: developers@kenyaniyetu.org)",
            "Accept-Language": "en-US,en;q=0.9",
        },
    ) as client:
        discovered_urls: List[str] = []
        if args.discover or args.index_url:
            discovered_urls = discover_links(client, source=args.source, extra_index_urls=args.index_url)

        target_urls = collect_target_urls(
            source=args.source,
            seed_records=seed_records,
            explicit_profile_urls=args.profile_url,
            discovered_urls=discovered_urls,
            include_guessed_mzalendo=args.guess_mzalendo_slugs,
        )

        if args.limit > 0:
            target_urls = target_urls[: args.limit]

        if not target_urls:
            logger.error("No profile URLs to scrape. Provide --profile-url, --discover, or a seed file with parliamentary_profile_url.")
            return 2

        scrape_stats.urls_total = len(target_urls)
        logger.info("Scraping %s profile URLs...", scrape_stats.urls_total)

        for idx, url in enumerate(target_urls, start=1):
            seed = seed_by_url.get(url.rstrip("/"))
            try:
                response = client.get(url)
                response.raise_for_status()
                record = scrape_profile(url, response.text, seed=seed, max_contributions=args.max_contributions)
                key = normalize_name(record["name"])

                if key in seed_by_name:
                    merged = dict(seed_by_name[key])
                    merged.update(record)
                    record = merged

                scraped_by_name[key] = record
                scrape_stats.urls_succeeded += 1
                logger.info("[%s/%s] Scraped %s", idx, scrape_stats.urls_total, record["name"])
            except Exception as exc:
                scrape_stats.urls_failed += 1
                failed.append({"url": url, "error": str(exc)})
                logger.warning("[%s/%s] Failed %s: %s", idx, scrape_stats.urls_total, url, exc)

    records = sorted(scraped_by_name.values(), key=lambda row: (row.get("name") or "").lower())
    scrape_stats.records_built = len(records)

    args.output_file.parent.mkdir(parents=True, exist_ok=True)
    with args.output_file.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    logger.info("Wrote %s scraped profile records to %s", len(records), args.output_file)

    if args.failed_file:
        args.failed_file.parent.mkdir(parents=True, exist_ok=True)
        with args.failed_file.open("w", encoding="utf-8") as f:
            json.dump(failed, f, ensure_ascii=False, indent=2)
        logger.info("Wrote %s failed URL entries to %s", len(failed), args.failed_file)

    if args.ingest:
        ingest_stats = ingest_scraped_records(records, dry_run=args.dry_run)
        logger.info(
            "Ingest summary: politicians created=%s updated=%s skipped=%s",
            ingest_stats["politicians_created"],
            ingest_stats["politicians_updated"],
            ingest_stats["skipped_rows"],
        )

    logger.info(
        "Scrape summary: urls=%s success=%s failed=%s records=%s",
        scrape_stats.urls_total,
        scrape_stats.urls_succeeded,
        scrape_stats.urls_failed,
        scrape_stats.records_built,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
