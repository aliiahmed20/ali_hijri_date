import { Component, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useHotkey } from "@web/core/hotkeys/hotkey_hook";
import { DateTimePicker } from "@web/core/datetime/datetime_picker";
import { HijriDateTimePicker } from "./hijri_datetime_picker";

/**
 * Drop-in replacement for the stock `DateTimePickerPopover` that renders either
 * the Hijri or the Gregorian calendar grid, with a small toggle icon in the
 * header to switch between them. Same props/behaviour as the core popover, so it
 * plugs into the datetime picker service unchanged (see the field's
 * `createPopover`).
 */
export class HijriDateTimePickerPopover extends Component {
    static components = { DateTimePicker, HijriDateTimePicker };

    static props = {
        close: Function, // Given by the Popover service
        pickerProps: { type: Object, shape: DateTimePicker.props },
    };

    static template = "ali_hijri_date.HijriDateTimePickerPopover";

    setup() {
        useHotkey("enter", () => this.props.close());
        // Open on the Hijri calendar by default; the toggle flips to Gregorian.
        this.ui = useState({ showHijri: true });
    }

    toggleCalendar() {
        this.ui.showHijri = !this.ui.showHijri;
    }

    /** Label of the calendar the toggle will switch *to*. */
    get toggleLabel() {
        return this.ui.showHijri ? _t("Gregorian") : _t("Hijri");
    }

    get toggleTitle() {
        return this.ui.showHijri
            ? _t("Switch to Gregorian calendar")
            : _t("Switch to Hijri calendar");
    }
}
