import { onWillRender, useEffect, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { makePopover } from "@web/core/popover/popover_hook";
import { useDateTimePicker } from "@web/core/datetime/datetime_picker_hook";
import { areDatesEqual, formatDate } from "@web/core/l10n/dates";
import { DateTimeField, dateField } from "@web/views/fields/datetime/datetime_field";
import { formatHijri, parseHijri } from "./hijri";
import { HijriDateTimePickerPopover } from "./hijri_datetime_picker_popover";

const { DateTime } = luxon;

// Always render Gregorian dates as a full numeric date with a 4-digit year,
// regardless of the user's locale date format (which may drop the year).
const GREGORIAN_DATE_FORMAT = "dd/MM/yyyy";

/**
 * Date field widget that shows the value in both the Hijri (Umm al-Qura) and
 * Gregorian calendars.
 *
 * The stored value stays a normal Gregorian `date`. Hijri is computed on the
 * frontend only. The popover datepicker is a Hijri-capable one with a toggle to
 * switch its grid between the Hijri and Gregorian calendars; when the Hijri
 * calendar is the active input mode, a dedicated input parses typed Hijri dates
 * back to Gregorian before saving.
 */
export class HijriDateField extends DateTimeField {
    static template = "ali_hijri_date.HijriDateField";

    setup() {
        // NB: we deliberately do NOT call super.setup(). The core setup wires the
        // datetime picker hook with the stock (Gregorian) popover; we need the
        // same wiring but with our `createPopover` so the popover shows the
        // Hijri-capable picker. Everything below mirrors DateTimeField.setup().
        const popoverService = useService("popover");

        // Session-only UI state for the input display calendar. Not persisted.
        this.ui = useState({ showHijri: false });

        const getPickerProps = () => {
            const value = this.getRecordValue();
            const pickerProps = {
                value,
                type: this.field.type,
                range: this.isRange(value),
                showRangeToggler:
                    this.relatedField && !this.props.required && !this.props.alwaysRange,
                onToggleRange,
            };
            if (this.props.maxDate) {
                pickerProps.maxDate = this.parseLimitDate(this.props.maxDate);
            }
            if (this.props.minDate) {
                pickerProps.minDate = this.parseLimitDate(this.props.minDate);
            }
            if (!isNaN(this.props.rounding)) {
                pickerProps.rounding = this.props.rounding;
            } else if (this.props.showSeconds) {
                pickerProps.rounding = 0;
            }
            if (this.props.maxPrecision) {
                pickerProps.maxPrecision = this.props.maxPrecision;
            }
            if (this.props.minPrecision) {
                pickerProps.minPrecision = this.props.minPrecision;
            }
            return pickerProps;
        };

        const onToggleRange = () => {
            this.state.range = !this.state.range;

            if (this.state.range) {
                let values = this.values;
                const optionalFieldIndex = values[0] ? 1 : 0;

                if (!values[0] && !values[1]) {
                    values = [DateTime.local(), DateTime.local()];
                }
                values[optionalFieldIndex] = optionalFieldIndex
                    ? values[0].plus({ hours: 1 })
                    : values[1].minus({ hours: 1 });

                this.state.focusedDateIndex = 0;
                this.state.value = values;
            } else {
                const mainFieldIndex = this.props.name === this.startDateField ? 0 : 1;

                this.state.focusedDateIndex = mainFieldIndex;
                this.state.value[mainFieldIndex ? 0 : 1] = false;
            }
        };

        const dateTimePicker = useDateTimePicker({
            target: "root",
            format: GREGORIAN_DATE_FORMAT,
            showSeconds: this.props.showSeconds,
            // Swap the stock popover for the Hijri-capable one. The service passes
            // the default component as the first argument; we ignore it.
            createPopover: (_component, options) =>
                makePopover(popoverService.add, HijriDateTimePickerPopover, options),
            get pickerProps() {
                return getPickerProps();
            },
            onChange: () => {
                this.state.range = this.isRange(this.state.value);
            },
            onClose: () => {
                this.picker.activeInput = "";
                this.state.value = this.getRecordValue();
            },
            onApply: async () => {
                const toUpdate = {};
                if (Array.isArray(this.state.value)) {
                    [toUpdate[this.startDateField], toUpdate[this.endDateField]] = this.state.value;
                } else {
                    toUpdate[this.props.name] = this.state.value;
                }

                for (const fieldName in toUpdate) {
                    if (areDatesEqual(toUpdate[fieldName], this.props.record.data[fieldName])) {
                        delete toUpdate[fieldName];
                    }
                }

                if (Object.keys(toUpdate).length) {
                    await this.props.record.update(toUpdate);
                }
            },
        });
        this.state = useState(dateTimePicker.state);
        this.picker = useState({ activeInput: "" });
        this.openPicker = dateTimePicker.open;

        this.startDate = useRef("start-date");
        this.endDate = useRef("end-date");

        useEffect(
            () => {
                [this.startDate, this.endDate].forEach((ref, index) => {
                    if (ref.el?.getAttribute("data-field") === this.picker.activeInput) {
                        ref.el.focus();
                        this.openPicker(index);
                    }
                });
            },
            () => [this.startDate.el?.tagName, this.endDate.el?.tagName, this.picker.activeInput]
        );

        onWillRender(() => this.triggerIsDirty());

        this.futureWarningMsg = _t("This date is in the future");
    }

    toggleCalendar() {
        this.ui.showHijri = !this.ui.showHijri;
    }

    get toggleLabel() {
        return this.ui.showHijri ? _t("Switch to Gregorian") : _t("Switch to Hijri");
    }

    /**
     * Gregorian display, always a full numeric date (e.g. "11/09/2026") so the
     * year is never dropped (the locale format used by `formatDate` may omit it).
     */
    formatGregorian(value) {
        return formatDate(value, { format: GREGORIAN_DATE_FORMAT });
    }

    /**
     * Primary display value, in the currently active calendar.
     * @override
     */
    getFormattedValue(valueIndex) {
        const value = this.values[valueIndex];
        if (!value) {
            return "";
        }
        return this.ui.showHijri
            ? formatHijri(value, { numeric: true })
            : this.formatGregorian(value);
    }

    /**
     * Secondary (muted) caption: always the calendar that is NOT primary, as a
     * full numeric date (e.g. "11/09/1447").
     */
    getCaptionValue(valueIndex) {
        const value = this.values[valueIndex];
        if (!value) {
            return "";
        }
        return this.ui.showHijri
            ? this.formatGregorian(value)
            : formatHijri(value, { numeric: true });
    }

    /**
     * "change" handler for the dedicated Hijri input (edit + Hijri mode only).
     * Parses the typed Hijri date to Gregorian and saves it; reverts on bad input.
     */
    async onHijriInput(ev) {
        const raw = ev.target.value.trim();
        if (!raw) {
            await this.props.record.update({ [this.props.name]: false });
            return;
        }
        const parsed = parseHijri(raw);
        if (parsed && parsed.isValid) {
            await this.props.record.update({ [this.props.name]: parsed });
        } else {
            // Revert to the canonical value.
            ev.target.value = this.getFormattedValue(0);
        }
    }
}

export const hijriDateField = {
    ...dateField,
    component: HijriDateField,
    displayName: _t("Hijri Date"),
};

registry.category("fields").add("hijri_date", hijriDateField);
