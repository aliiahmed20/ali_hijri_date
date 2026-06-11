# -*- coding: utf-8 -*-
"""Pure (Odoo-independent) Hijri (Umm al-Qura) <-> Gregorian conversion helpers.

Uses the ``hijri_converter`` package, which implements the official Saudi
Umm al-Qura calendar (same calendar family as the browser ``Intl`` API used by
the frontend widget). Kept free of Odoo imports so it can be unit-tested
standalone.
"""
from datetime import date

from hijri_converter import Gregorian, Hijri

# Selection-style list of Hijri months (value, label), 1-indexed.
HIJRI_MONTHS = [
    ("1", "Muharram"),
    ("2", "Safar"),
    ("3", "Rabi al-Awwal"),
    ("4", "Rabi al-Thani"),
    ("5", "Jumada al-Awwal"),
    ("6", "Jumada al-Thani"),
    ("7", "Rajab"),
    ("8", "Shaban"),
    ("9", "Ramadan"),
    ("10", "Shawwal"),
    ("11", "Dhu al-Qadah"),
    ("12", "Dhu al-Hijjah"),
]


def gregorian_to_hijri(greg_date):
    """Convert a ``datetime.date`` to a ``(year, month, day, month_name)`` tuple."""
    h = Gregorian(greg_date.year, greg_date.month, greg_date.day).to_hijri()
    return (h.year, h.month, h.day, h.month_name())


def hijri_to_gregorian(hy, hm, hd):
    """Convert a Hijri date to a ``datetime.date``.

    Raises ``ValueError`` for a non-existent Hijri date and ``OverflowError``
    when the date falls outside the supported Umm al-Qura range.
    """
    g = Hijri(int(hy), int(hm), int(hd)).to_gregorian()
    return date(g.year, g.month, g.day)


def format_gregorian(greg_date):
    """Readable Gregorian string, e.g. ``"20/03/2026 (Friday)"``."""
    if not greg_date:
        return ""
    return "%02d/%02d/%04d (%s)" % (
        greg_date.day,
        greg_date.month,
        greg_date.year,
        greg_date.strftime("%A"),
    )


def format_hijri(greg_date):
    """Readable Hijri string for a Gregorian date, e.g. ``"01/10/1447 (1 Shawwal 1447 AH)"``."""
    if not greg_date:
        return ""
    hy, hm, hd, name = gregorian_to_hijri(greg_date)
    return "%02d/%02d/%04d (%d %s %d AH)" % (hd, hm, hy, hd, name, hy)
