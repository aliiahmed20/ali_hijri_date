/**
 * Dependency-free Hijri (Umm al-Qura) <-> Gregorian conversion helpers.
 *
 * Forward conversion (Gregorian -> Hijri) relies on the browser's native
 * `Intl.DateTimeFormat` with the `islamic-umalqura` calendar, which matches the
 * official Saudi calendar. Reverse conversion (Hijri -> Gregorian) estimates the
 * Gregorian date from the Hijri epoch then refines it by scanning a few days and
 * comparing the forward conversion, which corrects the 29/30-day month variance
 * the arithmetic estimate cannot predict.
 *
 * All functions take/return luxon `DateTime` objects (Gregorian) so they plug
 * directly into Odoo's date field machinery. Hijri values are never persisted —
 * they are a pure frontend representation of the stored Gregorian date.
 */

import { _t } from "@web/core/l10n/translation";

const { DateTime } = luxon;

// Julian Day Number of the Umm al-Qura/Islamic epoch (1 Muharram 1 AH).
const ISLAMIC_EPOCH_JD = 1948439.5;
// Mean length of a Hijri year in days (12 lunar months).
const MEAN_HIJRI_YEAR = 354.367;

// Reusable Intl formatter: numeric Latin-digit Umm al-Qura parts in UTC.
const hijriPartsFormatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
});

// Translatable Hijri (Umm al-Qura) month names, 1-indexed by Hijri month.
// Wrapped in `_t` so they follow the user's language (see i18n/*.po). Built
// lazily and cached once the translations are loaded (a language change forces
// a full page reload, so the cache never goes stale).
let monthNamesCache = null;
function hijriMonthNames() {
    if (monthNamesCache) {
        return monthNamesCache;
    }
    const names = [
        _t("Muharram"),
        _t("Safar"),
        _t("Rabiʿ al-Awwal"),
        _t("Rabiʿ al-Thani"),
        _t("Jumada al-Awwal"),
        _t("Jumada al-Thani"),
        _t("Rajab"),
        _t("Shaʿban"),
        _t("Ramadan"),
        _t("Shawwal"),
        _t("Dhu al-Qaʿdah"),
        _t("Dhu al-Hijjah"),
    ];
    // `_t` yields a primitive string only once translations are loaded; until
    // then it returns a lazy object which we must not cache.
    if (typeof names[0] === "string") {
        monthNamesCache = names;
    }
    return names;
}

/**
 * Build a JS `Date` at noon UTC from a luxon date's calendar y/m/d. Using noon
 * UTC keeps the `Intl` (UTC) conversion on the intended calendar day regardless
 * of the user's timezone.
 *
 * @param {luxon.DateTime} luxonDate
 * @returns {Date}
 */
function toUtcNoon(luxonDate) {
    return new Date(Date.UTC(luxonDate.year, luxonDate.month - 1, luxonDate.day, 12));
}

/**
 * @param {luxon.DateTime} luxonDate
 * @returns {{ hy: number, hm: number, hd: number, monthName: string }}
 */
export function toHijriParts(luxonDate) {
    const jsDate = toUtcNoon(luxonDate);
    const parts = {};
    for (const { type, value } of hijriPartsFormatter.formatToParts(jsDate)) {
        parts[type] = value;
    }
    const hm = Number(parts.month);
    return {
        hy: Number(parts.year),
        hm,
        hd: Number(parts.day),
        monthName: hijriMonthNames()[hm - 1],
    };
}

/**
 * Translatable Hijri (Umm al-Qura) month name, in the user's language.
 *
 * @param {number} hy Hijri year (unused, kept for a stable call signature)
 * @param {number} hm Hijri month (1-12)
 * @returns {string} e.g. "Ramadan" (en) or "رمضان" (ar)
 */
export function hijriMonthName(hy, hm) {
    if (hm < 1 || hm > 12) {
        return "";
    }
    return hijriMonthNames()[hm - 1];
}

/**
 * Number of days (29 or 30) in the given Hijri month.
 *
 * @param {number} hy Hijri year
 * @param {number} hm Hijri month (1-12)
 * @returns {number}
 */
export function hijriDaysInMonth(hy, hm) {
    return fromHijri(hy, hm, 30) ? 30 : 29;
}

/**
 * @param {luxon.DateTime} luxonDate
 * @param {{ numeric?: boolean }} [options]
 * @returns {string} e.g. "15/09/1447" (numeric) or "15 Ramadan 1447 هـ" (long)
 */
export function formatHijri(luxonDate, { numeric = false } = {}) {
    if (!luxonDate) {
        return "";
    }
    const { hy, hm, hd, monthName } = toHijriParts(luxonDate);
    if (numeric) {
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(hd)}/${pad(hm)}/${hy}`;
    }
    return `${hd} ${monthName} ${hy} هـ`;
}

/**
 * Convert a Hijri (Umm al-Qura) date to a Gregorian luxon `DateTime`.
 *
 * @param {number} hy Hijri year
 * @param {number} hm Hijri month (1-12)
 * @param {number} hd Hijri day (1-30)
 * @returns {luxon.DateTime | null} null when the Hijri date does not exist
 */
export function fromHijri(hy, hm, hd) {
    if (!Number.isInteger(hy) || !Number.isInteger(hm) || !Number.isInteger(hd)) {
        return null;
    }
    if (hm < 1 || hm > 12 || hd < 1 || hd > 30) {
        return null;
    }

    // Arithmetic estimate of the Julian Day for the requested Hijri date.
    const estimatedJd =
        Math.floor((hy - 1) * MEAN_HIJRI_YEAR) +
        Math.floor((hm - 1) * 29.5) +
        hd +
        ISLAMIC_EPOCH_JD;

    // JD (at .5 = midnight UTC) -> Gregorian date.
    const estimatedMs = (estimatedJd - 2440587.5) * 86400000;
    let candidate = DateTime.fromMillis(estimatedMs, { zone: "utc" }).startOf("day");

    // Refine: scan a small window for the exact Umm al-Qura match. The window
    // absorbs the cumulative drift between the mean-length arithmetic estimate
    // and the real Umm al-Qura month boundaries.
    for (let offset = -7; offset <= 7; offset++) {
        const probe = candidate.plus({ days: offset });
        const parts = toHijriParts(probe);
        if (parts.hy === hy && parts.hm === hm && parts.hd === hd) {
            // Return a plain (timezone-naive) date matching how Odoo stores `date`.
            return DateTime.local(probe.year, probe.month, probe.day);
        }
    }
    return null;
}

/**
 * Parse a numeric Hijri date string ("dd/mm/yyyy", tolerating - and . too).
 *
 * @param {string} str
 * @returns {luxon.DateTime | null}
 */
export function parseHijri(str) {
    if (!str) {
        return null;
    }
    const match = String(str)
        .trim()
        .match(/^(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{3,4})$/);
    if (!match) {
        return null;
    }
    const [, hd, hm, hy] = match.map(Number);
    return fromHijri(hy, hm, hd);
}
