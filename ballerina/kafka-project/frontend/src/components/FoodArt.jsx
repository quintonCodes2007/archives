/** Real Unsplash photography. No AI-generated artwork or invented menu photos.
 * These are representative photos selected by item name; backend does not store image URLs.
 * Requires internet access for images.unsplash.com. See README for image sources.
 */
export function foodKind(name = "") {
  const text = String(name).toLowerCase();
  if (/pizza|margherita|pepperoni/.test(text)) return "pizza";
  if (/cola|sprite|water|drink|juice|soda|shake|fanta|smoothie|coffee|lemonade|mojito/.test(text)) return "drink";
  if (/fries|chips|potato/.test(text)) return "fries";
  if (/brownie|dessert|chocolate|cake|sweet|ice cream/.test(text)) return "dessert";
  if (/wrap|bread|sandwich|sub/.test(text)) return "wrap";
  if (/chicken|wing/.test(text) && !/burger/.test(text)) return "chicken";
  if (/salad|bowl|vegan|vegetable/.test(text)) return "salad";
  return "burger";
}
const imageIds = {
  burger: "photo-1568901346375-23c9450c58cd",
  burgerAlt: "photo-1550547660-d9450f859349",
  pizza: "photo-1513104890138-7c749659a591",
  drink: "photo-1544145945-f90425340c7e",
  fries: "photo-1573080496219-bb080dd4f877",
  dessert: "photo-1488477181946-6428a0291777",
  wrap: "photo-1529006557810-274b9b2fc783",
  chicken: "photo-1562967914-608f82629710",
  salad: "photo-1546069901-ba9599a7e63c",
};
export function photoUrl(kind = "burger", width = 1000) {
  return `https://images.unsplash.com/${imageIds[kind] || imageIds.burger}?auto=format&fit=crop&w=${width}&q=85`;
}
export default function FoodArt({ name, kind, className = "" }) {
  const type = kind || foodKind(name);
  return (
    <div className={`food-art photo-art food-art--${type} ${className}`}>
      <img src={photoUrl(type, 900)} alt={name || `${type} food photograph`} loading="lazy" decoding="async" referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}
