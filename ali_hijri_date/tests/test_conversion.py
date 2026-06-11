# -*- coding: utf-8 -*-
from datetime import date

from odoo.tests.common import Form, TransactionCase, tagged

from ..conversion import (
    format_gregorian,
    format_hijri,
    gregorian_to_hijri,
    hijri_to_gregorian,
)


@tagged("post_install", "-at_install", "ali_hijri_date")
class TestHijriConversion(TransactionCase):
    """Conversion helpers + converter wizard behaviour."""

    def test_gregorian_to_hijri_known_value(self):
        self.assertEqual(
            gregorian_to_hijri(date(2026, 3, 20)),
            (1447, 10, 1, "Shawwal"),
        )

    def test_hijri_to_gregorian_known_value(self):
        self.assertEqual(hijri_to_gregorian(1447, 9, 1), date(2026, 2, 18))

    def test_round_trip(self):
        """Every Gregorian date round-trips through Hijri unchanged."""
        d = date(2005, 1, 1)
        end = date(2045, 12, 31)
        step = 7  # weekly sampling keeps the test fast but broad
        from datetime import timedelta

        while d <= end:
            hy, hm, hd, _name = gregorian_to_hijri(d)
            self.assertEqual(
                hijri_to_gregorian(hy, hm, hd), d, "round-trip failed for %s" % d
            )
            d += timedelta(days=step)

    def test_invalid_hijri_raises(self):
        # 1448 has only 29 days in Shawwal in some years; use a clearly invalid month.
        with self.assertRaises(ValueError):
            hijri_to_gregorian(1447, 13, 1)

    def test_format_helpers(self):
        d = date(2026, 3, 20)
        self.assertEqual(format_gregorian(d), "20/03/2026 (Friday)")
        self.assertEqual(format_hijri(d), "01/10/1447 (1 Shawwal 1447 AH)")
        self.assertEqual(format_gregorian(False), "")
        self.assertEqual(format_hijri(False), "")

    def test_wizard_default_seeds_hijri(self):
        wizard = self.env["hijri.converter.wizard"].create({})
        self.assertTrue(wizard.gregorian_date)
        # default_get must have populated the Hijri fields from today.
        self.assertTrue(wizard.hijri_year)
        self.assertTrue(wizard.hijri_month)
        self.assertTrue(wizard.hijri_day)

    def test_wizard_onchange_gregorian_fills_hijri(self):
        with Form(self.env["hijri.converter.wizard"]) as form:
            form.gregorian_date = date(2026, 3, 20)
            self.assertEqual(form.hijri_year, 1447)
            self.assertEqual(form.hijri_month, "10")
            self.assertEqual(form.hijri_day, 1)
            self.assertEqual(form.result_hijri, "01/10/1447 (1 Shawwal 1447 AH)")

    def test_wizard_onchange_hijri_fills_gregorian(self):
        with Form(self.env["hijri.converter.wizard"]) as form:
            form.hijri_day = 1
            form.hijri_month = "9"
            form.hijri_year = 1447
            self.assertEqual(form.gregorian_date, date(2026, 2, 18))
            self.assertEqual(form.result_gregorian, "18/02/2026 (Wednesday)")
