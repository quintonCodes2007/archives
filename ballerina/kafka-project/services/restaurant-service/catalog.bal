// Small catalogue additions for the frontend. No schema or Kafka changes.
type Restaurant record {|
    int id;
    string name;
    string address;
    string? email;
    string? phone;
    boolean active;
    int menuCount;
    RestaurantHoursRow[] hours = [];
|};

type CreateRestaurantRequest record {|
    string name;
    string address;
    string? email = ();
    string? phone = ();
|};

type CreateMenuItemRequest record {|
    string name;
    string description;
    decimal price;
    int stockQuantity;
|};

function readRestaurants() returns Restaurant[]|error {
    stream<Restaurant, error?> rows = dbClient->query(
        `SELECT r.id, r.name, r.address, r.email, r.phone, r.active,
            (SELECT COUNT(*) FROM menu_items m WHERE m.restaurant_id = r.id) AS menuCount
         FROM restaurants r ORDER BY r.id`);
    Restaurant[] restaurants = [];
    check from Restaurant row in rows do { restaurants.push(row); };
    // Close the outer stream before querying each restaurant's weekly hours.
    foreach Restaurant restaurant in restaurants {
        stream<RestaurantHoursRow, error?> hours = dbClient->query(
            `SELECT day_of_week AS dayOfWeek,
                TIME_FORMAT(open_time, '%H:%i') AS openTime,
                TIME_FORMAT(close_time, '%H:%i') AS closeTime, closed
             FROM restaurant_hours WHERE restaurant_id = ${restaurant.id} ORDER BY day_of_week`);
        check from RestaurantHoursRow row in hours do { restaurant.hours.push(row); };
    }
    return restaurants;
}
