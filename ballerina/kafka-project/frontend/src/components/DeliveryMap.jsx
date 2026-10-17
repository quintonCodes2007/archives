import { useMemo } from "react";
import Icon from "./Icon";
// Approximate reference coordinates of NAMIBIAN CITIES, not a driver's GPS.
// Current delivery-service responses include addresses, not latitude/longitude.
const cities = [
  ["Windhoek", -22.5609, 17.0658], ["Swakopmund", -22.6784, 14.5266],
  ["Walvis Bay", -22.9576, 14.5053], ["Oshakati", -17.7883, 15.7044],
  ["Rundu", -17.9333, 19.7667], ["Katima Mulilo", -17.503, 24.275],
  ["Otjiwarongo", -20.4637, 16.6477], ["Grootfontein", -19.566, 18.116],
  ["Keetmanshoop", -26.5833, 18.1333], ["Lüderitz", -26.6481, 15.1594],
  ["Luderitz", -26.6481, 15.1594], ["Mariental", -24.627, 17.959],
  ["Okahandja", -21.979, 16.914], ["Tsumeb", -19.249, 17.717],
  ["Ondangwa", -17.912, 15.976], ["Rehoboth", -23.319, 17.09],
];
export default function DeliveryMap({ delivery }) {
  const area = useMemo(() => {
    const address = delivery?.deliveryAddress?.toLowerCase() || "";
    return cities.find(([name]) => address.includes(name.toLowerCase()));
  }, [delivery?.deliveryAddress]);
  // OSM's own interactive embed shows REAL geographical map tiles; never simulate a route.
  const bbox = area
    ? [area[2] - .25, area[1] - .2, area[2] + .25, area[1] + .2]
    : [11.4, -29.3, 25.6, -16.9];
  const params = new URLSearchParams({ bbox: bbox.join(","), layer: "mapnik" });
  if (area) params.set("marker", `${area[1]},${area[2]}`);
  const mapLink = area
    ? `https://www.openstreetmap.org/?mlat=${area[1]}&mlon=${area[2]}#map=11/${area[1]}/${area[2]}`
    : "https://www.openstreetmap.org/#map=6/-22.57/17.08";
  return (
    <section className="geo-panel">
      <div className="geo-heading">
        <div><span className="eyebrow">GEOGRAPHIC VIEW / OPENSTREETMAP</span><h2>Namibia. In motion.</h2><p>Explore real streets, towns and delivery destinations.</p></div>
        <a className="geo-external" target="_blank" rel="noopener noreferrer" href={mapLink}>FULL MAP ↗</a>
      </div>
      <div className="geo-frame">
        <iframe key={area?.[0] || "namibia"} title="Interactive real-world map of Namibia by OpenStreetMap" src={`https://www.openstreetmap.org/export/embed.html?${params.toString()}`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
        <div className="geo-top-label"><span className="signal-pulse"/> NAMIBIA / LIVE BASE MAP</div>
        <div className="geo-corner"><strong>{area ? area[0] : "NAMIBIA"}</strong><small>{area ? "Approximate city marker" : "Pan and zoom to explore"}</small></div>
      </div>
      <div className="geo-details">
        <div><Icon name="pin" size={18}/><span>{delivery ? <><strong>Order #{delivery.orderId}</strong> · {delivery.deliveryAddress}</> : "Select a delivery to explore its destination"}</span></div>
        <span className="geo-honesty">REAL MAP · NO DRIVER GPS OR ROUTE DATA IN BACKEND</span>
      </div>
      <p className="geo-disclaimer">Map data © OpenStreetMap contributors. A marker indicates a matched city centre, <strong>not</strong> a precise customer address, driver's position or tracked route. Map tiles require internet.</p>
    </section>
  );
}
