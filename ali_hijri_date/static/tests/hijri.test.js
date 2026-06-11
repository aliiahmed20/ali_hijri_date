import { beforeEach, describe, expect, test } from "@odoo/hoot";
import { allowTranslations } from "@web/../tests/web_test_helpers";
import {
    formatHijri,
    fromHijri,
    hijriDaysInMonth,
    hijriMonthName,
    parseHijri,
    toHijriParts,
} from "@ali_hijri_date/hijri";

const { DateTime } = luxon;

describe("hijri_date conversion", () => {
    // Month names go through `_t`; without this they stay lazy and throw when
    // coerced to a string. With it, `_t` resolves to the (English) source term.
    beforeEach(allowTranslations);

    test("Gregorian -> Hijri parts (known value)", () => {
        expect(toHijriParts(DateTime.local(2026, 3, 20))).toEqual({
            hy: 1447,
            hm: 10,
            hd: 1,
            monthName: "Shawwal",
        });
    });

    test("formatHijri numeric and long forms", () => {
        const d = DateTime.local(2026, 3, 20);
        expect(formatHijri(d, { numeric: true })).toBe("01/10/1447");
        expect(formatHijri(d, { numeric: false })).toBe("1 Shawwal 1447 هـ");
        expect(formatHijri(null)).toBe("");
    });

    test("Hijri -> Gregorian (known value)", () => {
        expect(fromHijri(1447, 9, 1).toISODate()).toBe("2026-02-18");
    });

    test("round-trips Gregorian -> Hijri -> Gregorian", () => {
        let d = DateTime.local(2005, 1, 1);
        const end = DateTime.local(2045, 12, 31);
        while (d <= end) {
            const { hy, hm, hd } = toHijriParts(d);
            expect(fromHijri(hy, hm, hd).toISODate()).toBe(d.toISODate());
            d = d.plus({ days: 7 });
        }
    });

    test("hijriMonthName long and short forms", () => {
        // 1447-09 is Ramadan, 1447-01 is Muharram.
        expect(hijriMonthName(1447, 9)).toBe("Ramadan");
        expect(hijriMonthName(1447, 1)).toBe("Muharram");
        // The short form may or may not be abbreviated depending on the engine,
        // but it must be a non-empty string.
        expect(hijriMonthName(1447, 9, { format: "short" }).length > 0).toBe(true);
    });

    test("hijriDaysInMonth returns 29 or 30", () => {
        const days = hijriDaysInMonth(1447, 9);
        expect(days === 29 || days === 30).toBe(true);
        // The month must round-trip: its last day exists, the next does not.
        expect(fromHijri(1447, 9, days)).not.toBe(null);
        expect(fromHijri(1447, 9, days + 1)).toBe(null);
    });

    test("parseHijri parses and rejects", () => {
        expect(parseHijri("01/09/1447").toISODate()).toBe("2026-02-18");
        expect(parseHijri("01-09-1447").toISODate()).toBe("2026-02-18");
        expect(parseHijri("garbage")).toBe(null);
        expect(parseHijri("01/13/1447")).toBe(null); // invalid month
        expect(parseHijri("")).toBe(null);
    });
});
