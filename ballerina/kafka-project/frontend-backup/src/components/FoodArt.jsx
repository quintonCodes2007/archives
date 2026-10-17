export function foodKind(name = "") {
  const text = name.toLowerCase();
  if (/pizza|margherita|pepperoni/.test(text)) return "pizza";
  if (/cola|sprite|water|drink/.test(text)) return "drink";
  if (/fries|chips/.test(text)) return "fries";
  if (/brownie|dessert|chocolate|cake/.test(text)) return "dessert";
  if (/wrap|bread/.test(text)) return "wrap";
  if (/chicken|wing/.test(text) && !/burger/.test(text)) return "chicken";
  return "burger";
}
// Decorative CSS illustrations, derived from names; never persisted as categories.
export default function FoodArt({ name, kind, className = "" }) {
  const type = kind || foodKind(name);
  return (
    <div
      className={`food-art food-art--${type} ${className}`}
      aria-hidden="true"
    >
      <div className="food-disc" />
      <div className="food-shape">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <span className="food-spark one" />
      <span className="food-spark two" />
    </div>
  );
}
