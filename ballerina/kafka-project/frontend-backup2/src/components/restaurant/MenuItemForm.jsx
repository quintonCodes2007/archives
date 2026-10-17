import { useState } from "react";
import { restaurantApi } from "../../api/restaurantApi";
import { useToast } from "../../context/ToastContext";
import { Field, Modal } from "../UI";

export default function MenuItemForm({ restaurantId, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notify = useToast();
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await restaurantApi.addMenu(restaurantId, {
        ...fields,
        name: fields.name.trim(),
        price: Number(fields.price),
        stockQuantity: Number(fields.stockQuantity),
      });
      notify("Menu item added.");
      onSaved();
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Add something delicious" onClose={onClose}>
      <form className="form-stack" onSubmit={save}>
        <Field label="Item name">
          <input
            name="name"
            maxLength={150}
            placeholder="e.g. Classic Beef Burger"
            required
          />
        </Field>
        <Field label="Description">
          <textarea name="description" maxLength={500} rows={3} required />
        </Field>
        <div className="form-row">
          <Field label="Price (N$)">
            <input
              name="price"
              type="number"
              min="0"
              max="99999999.99"
              step="0.01"
              required
            />
          </Field>
          <Field label="Starting stock">
            <input
              name="stockQuantity"
              type="number"
              min="0"
              max="2147483647"
              step="1"
              required
            />
          </Field>
        </div>
        {error && (
          <div className="error-notice" role="alert">
            {error}
          </div>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Adding…" : "Add to menu"}
        </button>
      </form>
    </Modal>
  );
}
