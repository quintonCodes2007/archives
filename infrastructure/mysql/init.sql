CREATE DATABASE IF NOT EXISTS food_delivery
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE food_delivery;

-- =========================================================
-- CUSTOMER SERVICE
-- =========================================================

CREATE TABLE customers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    username VARCHAR(50) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_customer_username UNIQUE (username),
    CONSTRAINT uq_customer_email UNIQUE (email),
    CONSTRAINT uq_customer_phone UNIQUE (phone)
);

CREATE TABLE customer_addresses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    customer_id BIGINT UNSIGNED NOT NULL,

    label VARCHAR(50),
    address_line VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_address_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE CASCADE
);

-- =========================================================
-- RESTAURANT SERVICE
-- =========================================================

CREATE TABLE restaurants (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    address VARCHAR(255) NOT NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_restaurant_email UNIQUE (email),
    CONSTRAINT uq_restaurant_phone UNIQUE (phone)
);

CREATE TABLE restaurant_hours (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    restaurant_id BIGINT UNSIGNED NOT NULL,

    day_of_week TINYINT NOT NULL,
    open_time TIME,
    close_time TIME,
    closed BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT chk_day_of_week
        CHECK (day_of_week BETWEEN 0 AND 6),

    CONSTRAINT chk_restaurant_hours CHECK (
        (closed = TRUE
         AND open_time IS NULL
         AND close_time IS NULL)
        OR
        (closed = FALSE
         AND open_time IS NOT NULL
         AND close_time IS NOT NULL
         AND close_time > open_time)
    ),

    CONSTRAINT uq_restaurant_day
        UNIQUE (restaurant_id, day_of_week),

    CONSTRAINT fk_hours_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id)
        ON DELETE CASCADE
);

CREATE TABLE menu_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    restaurant_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(150) NOT NULL,
    description VARCHAR(500),

    price DECIMAL(10,2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    available BOOLEAN NOT NULL DEFAULT TRUE,

    version BIGINT UNSIGNED NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_menu_price
        CHECK (price >= 0),

    CONSTRAINT chk_stock_quantity
        CHECK (stock_quantity >= 0),

    CONSTRAINT uq_restaurant_menu_item
        UNIQUE (restaurant_id, name),

    CONSTRAINT fk_menu_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id)
        ON DELETE CASCADE
);

-- =========================================================
-- ORDER SERVICE
-- =========================================================

CREATE TABLE orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    customer_id BIGINT UNSIGNED NOT NULL,
    restaurant_id BIGINT UNSIGNED NOT NULL,

    delivery_address VARCHAR(255) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    total_amount DECIMAL(10,2) NOT NULL,

    version BIGINT UNSIGNED NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_order_total
        CHECK (total_amount >= 0),

    CONSTRAINT chk_order_status CHECK (
        status IN (
            'CREATED',
            'CONFIRMED',
            'PREPARING',
            'READY',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'CANCELLED'
        )
    ),

    CONSTRAINT fk_order_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id),

    CONSTRAINT fk_order_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id)
);

CREATE TABLE order_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    order_id BIGINT UNSIGNED NOT NULL,
    menu_item_id BIGINT UNSIGNED NOT NULL,

    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,

    CONSTRAINT chk_order_item_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_order_item_price
        CHECK (unit_price >= 0),

    CONSTRAINT uq_order_menu_item
        UNIQUE (order_id, menu_item_id),

    CONSTRAINT fk_order_item_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_order_item_menu
        FOREIGN KEY (menu_item_id)
        REFERENCES menu_items(id)
);

CREATE TABLE order_status_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    order_id BIGINT UNSIGNED NOT NULL,

    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,

    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_history_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_orders_customer
    ON orders(customer_id);

CREATE INDEX idx_orders_restaurant
    ON orders(restaurant_id);

CREATE INDEX idx_orders_status
    ON orders(status);


-- =========================================================
-- PAYMENT SERVICE
-- =========================================================

CREATE TABLE payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    order_id BIGINT UNSIGNED NOT NULL,

    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    transaction_reference VARCHAR(100),

    version BIGINT UNSIGNED NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_payment_amount
        CHECK (amount >= 0),

    CONSTRAINT chk_payment_status CHECK (
        status IN (
            'PENDING',
            'COMPLETED',
            'FAILED',
            'REFUNDED'
        )
    ),

    CONSTRAINT uq_payment_order
        UNIQUE (order_id),

    CONSTRAINT uq_transaction_reference
        UNIQUE (transaction_reference),

    CONSTRAINT fk_payment_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
);

-- =========================================================
-- DELIVERY SERVICE
-- =========================================================

CREATE TABLE drivers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',

    version BIGINT UNSIGNED NOT NULL DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_driver_email
        UNIQUE (email),

    CONSTRAINT uq_driver_phone
        UNIQUE (phone),

    CONSTRAINT chk_driver_status CHECK (
        status IN (
            'AVAILABLE',
            'ASSIGNED',
            'OFFLINE'
        )
    )
);

CREATE TABLE deliveries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    order_id BIGINT UNSIGNED NOT NULL,
    driver_id BIGINT UNSIGNED NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED',

    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    picked_up_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,

    version BIGINT UNSIGNED NOT NULL DEFAULT 0,

    CONSTRAINT uq_delivery_order
        UNIQUE (order_id),

    CONSTRAINT chk_delivery_status CHECK (
        status IN (
            'ASSIGNED',
            'PICKED_UP',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'CANCELLED'
        )
    ),

    CONSTRAINT fk_delivery_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id),

    CONSTRAINT fk_delivery_driver
        FOREIGN KEY (driver_id)
        REFERENCES drivers(id)
);

-- =========================================================
-- NOTIFICATION SERVICE
-- =========================================================

CREATE TABLE notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    order_id BIGINT UNSIGNED,

    recipient_type VARCHAR(30) NOT NULL,

    customer_id BIGINT UNSIGNED,
    restaurant_id BIGINT UNSIGNED,
    driver_id BIGINT UNSIGNED,

    channel VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',

    event_type VARCHAR(100),
    message VARCHAR(500) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'SENT',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_notification_recipient_type CHECK (
        recipient_type IN (
            'CUSTOMER',
            'RESTAURANT',
            'DRIVER'
        )
    ),

    CONSTRAINT chk_notification_channel CHECK (
        channel IN (
            'SYSTEM',
            'EMAIL',
            'SMS'
        )
    ),

    CONSTRAINT chk_notification_status CHECK (
        status IN (
            'PENDING',
            'SENT',
            'FAILED'
        )
    ),

    CONSTRAINT chk_notification_recipient CHECK (
        (
            recipient_type = 'CUSTOMER'
            AND customer_id IS NOT NULL
            AND restaurant_id IS NULL
            AND driver_id IS NULL
        )
        OR
        (
            recipient_type = 'RESTAURANT'
            AND restaurant_id IS NOT NULL
            AND customer_id IS NULL
            AND driver_id IS NULL
        )
        OR
        (
            recipient_type = 'DRIVER'
            AND driver_id IS NOT NULL
            AND customer_id IS NULL
            AND restaurant_id IS NULL
        )
    ),

    CONSTRAINT fk_notification_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id),

    CONSTRAINT fk_notification_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id),

    CONSTRAINT fk_notification_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id),

    CONSTRAINT fk_notification_driver
        FOREIGN KEY (driver_id)
        REFERENCES drivers(id)
);

-- =========================================================
-- KAFKA EVENT IDEMPOTENCY
-- =========================================================

CREATE TABLE processed_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    event_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    topic_name VARCHAR(100) NOT NULL,

    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_processed_event
        UNIQUE (event_id, service_name)
);

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX idx_menu_restaurant
    ON menu_items(restaurant_id);

CREATE INDEX idx_payment_status
    ON payments(status);

CREATE INDEX idx_driver_status
    ON drivers(status);

CREATE INDEX idx_delivery_driver
    ON deliveries(driver_id);

CREATE INDEX idx_delivery_status
    ON deliveries(status);

CREATE INDEX idx_notifications_order
    ON notifications(order_id);

CREATE INDEX idx_processed_events_topic
    ON processed_events(topic_name);

