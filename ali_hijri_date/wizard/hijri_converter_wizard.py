# -*- coding: utf-8 -*-
from odoo import api, fields, models

from ..conversion import (
    HIJRI_MONTHS,
    format_gregorian,
    format_hijri,
    gregorian_to_hijri,
    hijri_to_gregorian,
)


class HijriConverterWizard(models.TransientModel):
    _name = "hijri.converter.wizard"
    _description = "Hijri / Gregorian Date Converter"

    gregorian_date = fields.Date(
        string="Gregorian Date",
        default=fields.Date.context_today,
    )
    hijri_year = fields.Integer(string="Hijri Year")
    hijri_month = fields.Selection(HIJRI_MONTHS, string="Hijri Month")
    hijri_day = fields.Integer(string="Hijri Day")

    result_gregorian = fields.Char(
        string="Gregorian", compute="_compute_results", readonly=True
    )
    result_hijri = fields.Char(
        string="Hijri", compute="_compute_results", readonly=True
    )

    @api.depends("gregorian_date")
    def _compute_results(self):
        for wizard in self:
            wizard.result_gregorian = format_gregorian(wizard.gregorian_date)
            wizard.result_hijri = format_hijri(wizard.gregorian_date)

    @api.model
    def default_get(self, fields_list):
        # Seed the Hijri fields from today's Gregorian default.
        values = super().default_get(fields_list)
        greg = values.get("gregorian_date")
        if greg:
            greg = fields.Date.to_date(greg)
            hy, hm, hd, _name = gregorian_to_hijri(greg)
            values.update(hijri_year=hy, hijri_month=str(hm), hijri_day=hd)
        return values

    @api.onchange("gregorian_date")
    def _onchange_gregorian_date(self):
        """User picked a Gregorian date -> fill in the Hijri fields."""
        if not self.gregorian_date:
            return
        hy, hm, hd, _name = gregorian_to_hijri(self.gregorian_date)
        self.hijri_year = hy
        self.hijri_month = str(hm)
        self.hijri_day = hd

    @api.onchange("hijri_year", "hijri_month", "hijri_day")
    def _onchange_hijri(self):
        """User entered a Hijri date -> compute the Gregorian date."""
        if not (self.hijri_year and self.hijri_month and self.hijri_day):
            return
        try:
            self.gregorian_date = hijri_to_gregorian(
                self.hijri_year, int(self.hijri_month), self.hijri_day
            )
        except (ValueError, OverflowError):
            return {
                "warning": {
                    "title": "Invalid Hijri Date",
                    "message": "The entered Hijri date does not exist or is out "
                    "of the supported Umm al-Qura range.",
                }
            }
