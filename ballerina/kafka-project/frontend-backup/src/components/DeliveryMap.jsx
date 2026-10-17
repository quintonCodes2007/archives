import Icon from "./Icon";
export default function DeliveryMap({ delivery }) {
  // Schematic positions only. A future coordinate adapter can provide points
  // here; there are no coordinates/GPS in the current database schema.
  const progress =
    delivery?.status === "DELIVERED"
      ? 100
      : delivery?.status === "OUT_FOR_DELIVERY"
        ? 65
        : delivery?.status === "PICKED_UP"
          ? 30
          : 0;
  return (
    <section className="panel map-panel">
      <div className="row-between">
        <div>
          <h2>Delivery route</h2>
          <p className="muted">
            {delivery
              ? `Order #${delivery.orderId} · ${delivery.driverName}`
              : "Select a delivery to view its progress"}
          </p>
        </div>
        <span className="map-label">Illustrative map</span>
      </div>
      <div className="schematic-map">
        <div className="map-park park-one" />
        <div className="map-park park-two" />
        <div className="map-block block-one" />
        <div className="map-block block-two" />
        <div className="map-block block-three" />
        <svg
          viewBox="0 0 700 240"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="map-road"
            d="M-20 62H740M-20 180H740M120-10V260M350-10V260M590-10V260"
          />
          <path className="map-route" d="M120 62H350V180H590" />
        </svg>
        <span className="map-marker restaurant-marker">
          <Icon name="store" size={23} />
          <small>Restaurant</small>
        </span>
        <span className="map-marker customer-marker">
          <Icon name="pin" size={23} />
          <small>Customer</small>
        </span>
        {delivery && (
          <span
            className="map-marker driver-marker"
            style={{
              left: `${17 + progress * 0.67}%`,
              top: progress > 40 ? "70%" : "27%",
            }}
          >
            <Icon name="truck" size={21} />
          </span>
        )}
      </div>
      <div className="map-key">
        <span>
          <i />
          Route progress illustration
        </span>
        <span>No live GPS · works offline</span>
      </div>
      {delivery && (
        <div className="map-caption">
          <strong>{delivery.restaurantName}</strong>
          <Icon name="arrow" size={17} />
          <span>{delivery.deliveryAddress}</span>
        </div>
      )}
    </section>
  );
}
