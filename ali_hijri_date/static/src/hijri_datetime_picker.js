import { _t } from "@web/core/l10n/translation";
import { DateTimePicker } from "@web/core/datetime/datetime_picker";
import { getStartOfLocalWeek, isInRange, today } from "@web/core/l10n/dates";
import { fromHijri, hijriDaysInMonth, hijriMonthName, toHijriParts } from "./hijri";

/**
 * A calendar picker that renders the grid in the Hijri (Umm al-Qura) calendar
 * while still operating on Gregorian luxon `DateTime` values internally. Day,
 * month and year cells carry their normal Gregorian `range` (so selection keeps
 * storing a plain Gregorian `date`); only the *labels* and navigation steps are
 * expressed in Hijri terms.
 *
 * It subclasses the stock {@link DateTimePicker} and reuses its template
 * (`web.DateTimePicker`), overriding only the precision levels (item/title
 * generation) and the navigation/focus logic.
 */

const { Info } = luxon;

const numberRange = (min, max) => [...Array(max - min)].map((_, i) => i + min);

// Mirror of the (non-exported) core helper: the ISO week number of a week row
// is taken from its 4th day, which is always in the "owning" week.
const toWeekItem = (weekDayItems) => ({
    number: weekDayItems[3].range[0].weekNumber,
    days: weekDayItems,
});

const getStartOfHijriDecade = (hy) => Math.floor(hy / 10) * 10;
const getStartOfHijriCentury = (hy) => Math.floor(hy / 100) * 100;

const DAYS_PER_WEEK = 7;
const WEEKS_PER_MONTH = 6;

/**
 * Build the day grid of the Hijri month that contains `date`.
 * @returns {import("@web/core/datetime/datetime_picker").MonthItem[]}
 */
function buildHijriDays(date, { maxDate, minDate, showWeekNumbers, isDateValid, dayCellClass }) {
    const { hy, hm } = toHijriParts(date);
    const firstGreg = fromHijri(hy, hm, 1);

    /** @type {import("@web/core/datetime/datetime_picker").WeekItem[]} */
    const weeks = [];
    let cursor = getStartOfLocalWeek(firstGreg);
    for (let w = 0; w < WEEKS_PER_MONTH; w++) {
        const weekDays = [];
        for (let d = 0; d < DAYS_PER_WEEK; d++) {
            const day = cursor.plus({ days: d });
            const range = [day, day.endOf("day")];
            const parts = toHijriParts(day);
            const inMonth = parts.hy === hy && parts.hm === hm;
            weekDays.push({
                id: day.toISODate(),
                includesToday: isInRange(today(), range),
                isOutOfRange: !inMonth,
                isValid: isInRange(range, [minDate, maxDate]) && (isDateValid?.(day) ?? true),
                label: String(parts.hd),
                range,
                extraClass: dayCellClass?.(day) || "",
            });
        }
        cursor = cursor.plus({ days: DAYS_PER_WEEK });
        weeks.push(toWeekItem(weekDays));
    }

    const daysOfWeek = weeks[0].days.map((d) => [
        d.range[0].weekdayShort,
        d.range[0].weekdayLong,
        Info.weekdays("narrow", { locale: d.range[0].locale })[d.range[0].weekday - 1],
    ]);
    if (showWeekNumbers) {
        daysOfWeek.unshift(["", _t("Week numbers"), ""]);
    }

    return [{ id: "__hmonth__0", number: hm, daysOfWeek, weeks }];
}

/** Build the 12-month grid of the Hijri year that contains `date`. */
function buildHijriMonths(date, { maxDate, minDate }) {
    const { hy } = toHijriParts(date);
    return numberRange(1, 13)
        .map((m) => {
            const start = fromHijri(hy, m, 1);
            if (!start) {
                return null;
            }
            const range = [start, start.plus({ days: hijriDaysInMonth(hy, m) - 1 }).endOf("day")];
            return {
                id: `hm-${hy}-${m}`,
                includesToday: isInRange(today(), range),
                isOutOfRange: false,
                isValid: isInRange(range, [minDate, maxDate]),
                label: hijriMonthName(hy, m),
                range,
            };
        })
        .filter(Boolean);
}

/** Build a grid of single Hijri years for the decade that contains `date`. */
function buildHijriYears(date, { maxDate, minDate }) {
    const { hy } = toHijriParts(date);
    const startDecade = getStartOfHijriDecade(hy);
    return numberRange(-1, 11)
        .map((i) => {
            const y = startDecade + i;
            const start = fromHijri(y, 1, 1);
            const end = fromHijri(y, 12, hijriDaysInMonth(y, 12));
            if (!start || !end) {
                return null;
            }
            const range = [start, end.endOf("day")];
            return {
                id: `hy-${y}`,
                includesToday: isInRange(today(), range),
                isOutOfRange: i < 0 || i >= 10,
                isValid: isInRange(range, [minDate, maxDate]),
                label: String(y),
                range,
            };
        })
        .filter(Boolean);
}

/** Build a grid of Hijri decades for the century that contains `date`. */
function buildHijriDecades(date, { maxDate, minDate }) {
    const { hy } = toHijriParts(date);
    const startCentury = getStartOfHijriCentury(hy);
    return numberRange(-1, 11)
        .map((i) => {
            const y = startCentury + i * 10;
            const endYear = y + 9;
            const start = fromHijri(y, 1, 1);
            const end = fromHijri(endYear, 12, hijriDaysInMonth(endYear, 12));
            if (!start || !end) {
                return null;
            }
            const range = [start, end.endOf("day")];
            return {
                id: `hd-${y}`,
                includesToday: isInRange(today(), range),
                isOutOfRange: i < 0 || i >= 10,
                isValid: isInRange(range, [minDate, maxDate]),
                label: String(y),
                range,
            };
        })
        .filter(Boolean);
}

const HIJRI_PRECISION_LEVELS = new Map()
    .set("days", {
        mainTitle: _t("Select month"),
        nextTitle: _t("Next month"),
        prevTitle: _t("Previous month"),
        getTitle: (date) => {
            const { hy, hm } = toHijriParts(date);
            return `${hijriMonthName(hy, hm)} ${hy}`;
        },
        getItems: buildHijriDays,
    })
    .set("months", {
        mainTitle: _t("Select year"),
        nextTitle: _t("Next year"),
        prevTitle: _t("Previous year"),
        getTitle: (date) => String(toHijriParts(date).hy),
        getItems: buildHijriMonths,
    })
    .set("years", {
        mainTitle: _t("Select decade"),
        nextTitle: _t("Next decade"),
        prevTitle: _t("Previous decade"),
        getTitle: (date) => {
            const start = getStartOfHijriDecade(toHijriParts(date).hy);
            return `${start} - ${start + 9}`;
        },
        getItems: buildHijriYears,
    })
    .set("decades", {
        mainTitle: _t("Select century"),
        nextTitle: _t("Next century"),
        prevTitle: _t("Previous century"),
        getTitle: (date) => {
            const start = getStartOfHijriCentury(toHijriParts(date).hy);
            return `${start} - ${start + 99}`;
        },
        getItems: buildHijriDecades,
    });

export class HijriDateTimePicker extends DateTimePicker {
    static template = "web.DateTimePicker";

    get activePrecisionLevel() {
        return HIJRI_PRECISION_LEVELS.get(this.state.precision);
    }

    /**
     * Focus on the exact value (not the Gregorian start-of-month), so the Hijri
     * month shown is the one that actually contains the value.
     * @override
     */
    adjustFocus(values, focusedDateIndex) {
        if (!this.shouldAdjustFocusDate && this.state.focusDate) {
            return;
        }
        const dateToFocus =
            values[focusedDateIndex] || values[focusedDateIndex === 1 ? 0 : 1] || today();
        this.shouldAdjustFocusDate = false;
        this.state.focusDate = this.clamp(dateToFocus.startOf("day"));
    }

    /** @override */
    next(ev) {
        ev.preventDefault();
        this.state.focusDate = this.clamp(this._shiftFocus(this.state.focusDate, 1));
    }

    /** @override */
    previous(ev) {
        ev.preventDefault();
        this.state.focusDate = this.clamp(this._shiftFocus(this.state.focusDate, -1));
    }

    /**
     * Step the focus date by one Hijri unit of the active precision.
     * @param {DateTime} date
     * @param {1 | -1} dir
     */
    _shiftFocus(date, dir) {
        const { hy, hm } = toHijriParts(date);
        switch (this.state.precision) {
            case "days": {
                let m = hm + dir;
                let y = hy;
                if (m < 1) {
                    m = 12;
                    y -= 1;
                } else if (m > 12) {
                    m = 1;
                    y += 1;
                }
                return fromHijri(y, m, 1) || date;
            }
            case "months":
                return fromHijri(hy + dir, 1, 1) || date;
            case "years":
                return fromHijri(hy + dir * 10, 1, 1) || date;
            case "decades":
                return fromHijri(hy + dir * 100, 1, 1) || date;
        }
        return date;
    }
}
