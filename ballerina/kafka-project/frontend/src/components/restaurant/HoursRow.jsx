import { useState } from "react";
import { restaurantApi } from "../../api/restaurantApi";
import { useToast } from "../../context/ToastContext";
import { DAYS } from "../../utils/format";

export default function HoursRow({ restaurantId, day, row, onSaved }) {
  const [closed, setClosed] = useState(row?.closed ?? false);
  const [busy, setBusy] = useState(false);
  const notify = useToast();
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (!closed && fields.openTime >= fields.closeTime) {
      notify("Closing time must be later than opening time.", "error");
      setBusy(false);
      return;
    }
    try {
      await restaurantApi.setHours(restaurantId, day, {
        openTime: closed ? "" : fields.openTime,
        closeTime: closed ? "" : fields.closeTime,
        closed,
      });
      notify(`${DAYS[day]} hours saved.`);
      onSaved();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="hours-row" onSubmit={save}>
      <div>
        <strong>{DAYS[day]}</strong>
        {!row && <small>Not published</small>}
      </div>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={closed}
          onChange={(e) => setClosed(e.target.checked)}
        />
        Closed
      </label>
      <input
        aria-label={`${DAYS[day]} opening time`}
        type="time"
        name="openTime"
        disabled={closed}
        defaultValue={row?.openTime || "08:00"}
        required={!closed}
      />
      <span className="muted">to</span>
      <input
        aria-label={`${DAYS[day]} closing time`}
        type="time"
        name="closeTime"
        disabled={closed}
        defaultValue={row?.closeTime || "22:00"}
        required={!closed}
      />
      <button className="button secondary" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
