# -*- coding: utf-8 -*-
{
    "name": "Hijri Date Widget",
    "version": "19.0.1.0.0",
    "category": "Productivity",
    "summary": "Date widget showing both Hijri (Umm al-Qura) and Gregorian dates",
    "description": """
Hijri Date Widget
=================
Adds a ``hijri_date`` field widget for ``date`` fields that displays the value
in both the Hijri (Umm al-Qura) and Gregorian calendars, with a toggle to
switch the primary calendar.

The value is stored as a normal Gregorian ``date`` in the database; the Hijri
representation is computed purely on the frontend (deterministic conversion via
the browser's ``Intl`` API) and converted back to Gregorian before saving.

Usage::

    <field name="some_date" widget="hijri_date"/>
""",
    "author": "Ali Mohamed",
    "support": "aaegdev@gmail.com",
    "website": "https://github.com/aliiahmed20",
    "depends": ["web"],
    "external_dependencies": {"python": ["hijri_converter"]},
    "data": [
        "security/security.xml",
        "security/ir.model.access.csv",
        "wizard/hijri_converter_wizard_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "ali_hijri_date/static/src/**/*",
        ],
        "web.assets_unit_tests": [
            "ali_hijri_date/static/tests/**/*",
        ],
    },
    "installable": True,
    "auto_install": False,
    "license": "LGPL-3",
    "images": ["static/description/banner.png"]

}
