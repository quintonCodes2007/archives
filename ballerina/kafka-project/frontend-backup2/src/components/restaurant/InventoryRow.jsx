import { useState } from "react";
import { restaurantApi } from "../../api/restaurantApi";
import { useToast } from "../../context/ToastContext";
import { money } from "../../utils/format";
import { Badge, Field } from "../UI";
import FoodArt from "../FoodArt";

export default function InventoryRow({ restaurantId, item, onSaved }) {
  const [busy, setBusy] = useState(false);
  const notify = useToast();
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await restaurantApi.inventory(restaurantId, item.id, {
        stockQuantity: Number(fields.stock),
        available: fields.available === "on",
      });
      notify(`${item.name}: inventory updated.`);
      onSaved();
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="inventory-item">
      <FoodArt name={item.name} />
      <div className="inventory-description">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <strong>{money(item.price)}</strong>
        <Badge
          status={
            item.available && item.stockQuantity > 0 ? "AVAILABLE" : "OFFLINE"
          }
        >
          {item.available ? `${item.stockQuantity} in stock` : "Unavailable"}
        </Badge>
      </div>
      <form className="inventory-form" onSubmit={save}>
        <Field label="Set current stock">
          <input
            aria-label={`${item.name} stock`}
            type="number"
            name="stock"
            min="0"
            max="2147483647"
            step="1"
            defaultValue={item.stockQuantity}
            required
          />
        </Field>
        <label className="checkbox-field">
          <input
            type="checkbox"
            name="available"
            defaultChecked={item.available}
          />
          Available
        </label>
        <button className="button secondary" disabled={busy}>
          {busy ? "Saving…" : "Save stock"}
        </button>
      </form>
    </article>
  );
}
