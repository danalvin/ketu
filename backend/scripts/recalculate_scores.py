#!/usr/bin/env python3
"""
Recalculate politician transparency scores from imported cases and promises.

Usage:
    python scripts/recalculate_scores.py
    python scripts/recalculate_scores.py --dry-run --verbose
"""

from __future__ import annotations

import argparse
import logging
import math
import sys
from pathlib import Path

from sqlalchemy.orm import joinedload

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.database import SessionLocal  # noqa: E402
from app.models.case import CaseSeverity, CaseStatus  # noqa: E402
from app.models.politician import Politician  # noqa: E402


logger = logging.getLogger("recalculate_scores")


SEVERITY_WEIGHTS = {
    CaseSeverity.LOW: 5,
    CaseSeverity.MEDIUM: 10,
    CaseSeverity.HIGH: 18,
    CaseSeverity.CRITICAL: 25,
}

STATUS_MULTIPLIERS = {
    CaseStatus.PENDING: 1.0,
    CaseStatus.ONGOING: 1.0,
    CaseStatus.APPEALED: 1.0,
    CaseStatus.RESOLVED: 0.5,
    CaseStatus.DISMISSED: 0.2,
}


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def compute_case_penalty(politician: Politician) -> float:
    penalty = 0.0
    for legal_case in politician.cases:
        severity_weight = SEVERITY_WEIGHTS.get(legal_case.severity, 8)
        status_multiplier = STATUS_MULTIPLIERS.get(legal_case.status, 1.0)
        base_penalty = severity_weight * status_multiplier

        if legal_case.impact_score is not None:
            impact_factor = float(legal_case.impact_score) / 100.0
            base_penalty *= (0.5 + impact_factor)

        penalty += base_penalty

    return penalty


def compute_promise_score(politician: Politician) -> float:
    if not politician.promises:
        return 50.0
    values = [max(0, min(100, int(p.fulfillment_percentage or 0))) for p in politician.promises]
    return sum(values) / len(values)


def compute_confidence(politician: Politician) -> float:
    evidence_points = len(politician.cases) + len(politician.promises)
    # Diminishing returns confidence curve.
    confidence = 35.0 + 60.0 * (1 - math.exp(-evidence_points / 6.0))
    return clamp(confidence, 20.0, 95.0)


def recalculate(dry_run: bool = False) -> None:
    with SessionLocal() as db:
        politicians = (
            db.query(Politician)
            .options(joinedload(Politician.cases), joinedload(Politician.promises))
            .all()
        )

        for politician in politicians:
            case_penalty = compute_case_penalty(politician)
            case_component = clamp(100.0 - case_penalty, 0.0, 100.0)
            promise_component = compute_promise_score(politician)

            # Weighted score: promises + legal integrity.
            score = 0.60 * promise_component + 0.40 * case_component
            score = round(clamp(score, 0.0, 100.0), 2)
            confidence = round(compute_confidence(politician), 2)

            politician.transparency_score = score
            politician.confidence_level = confidence

            logger.debug(
                "Scored %s -> score=%s confidence=%s (cases=%s promises=%s)",
                politician.name,
                score,
                confidence,
                len(politician.cases),
                len(politician.promises),
            )

        if dry_run:
            db.rollback()
            logger.info("Dry run complete. No score updates committed.")
        else:
            db.commit()
            logger.info("Score recalculation committed for %s politicians.", len(politicians))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Recalculate transparency scores")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    recalculate(dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
