# Laundry Services

<cite>
**Referenced Files in This Document**
- [package.json](file://package.json)
- [server.js](file://server.js)
- [README.md](file://README.md)
- [src/main.js](file://src/main.js)
- [src/store.js](file://src/store.js)
- [src/cartManager.js](file://src/cartManager.js)
- [src/checkout.js](file://src/checkout.js)
- [src/route/products.js](file://src/routes/products.js)
- [src/route/orders.js](file://src/routes/orders.js)
- [src/route/payment.js](file://src/routes/payment.js)
- [src/route/auth.js](file://src/routes/auth.js)
- [src/route/admin.js](file://src/routes/admin.js)
- [src/utils/email.js](file://src/utils/email.js)
- [src/utils/logger.js](file://src/utils/logger.js)
- [database/db.js](file://database/db.js)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This project is a modern e-commerce platform for a laundry and fitness services hub. It integrates with a third-party Gym Master system for membership and product data, supports online shopping with Paystack payments, and provides order tracking and admin management. The frontend is built with vanilla JavaScript and CSS, while the backend is a Node.js/Express server with optional MongoDB and PostgreSQL persistence.

## Project Structure
The project follows a modular structure:
- Frontend assets and pages under the project root
- Client-side scripts in src/ for UI interactions and cart logic
- Backend routes under src/routes/
- Utilities under src/utils/
- Database configuration under database/
- Server entry point at server.js
- Package configuration at package.json

```mermaid
graph TB
subgraph "Frontend"
HTML["HTML Pages<br/>index.html, store.html, checkout.html, orders.html, track-order.html"]
JSMain["src/main.js<br/>Global UI Enhancements"]
JSStore["src/store.js<br/>Product Catalog & Filters"]
JSCart["src/cartManager.js<br/>Shopping Cart"]
JSCheckout["src/checkout.js<br/>Checkout & Payments"]
end
subgraph "Backend"
Server["server.js<br/>Express Server"]
RoutesProducts["src/routes/products.js"]
RoutesOrders["src/routes/orders.js"]
RoutesPayment["src/routes/payment.js"]
RoutesAuth["src/routes/auth.js"]
RoutesAdmin["src/routes/admin.js"]
UtilsEmail["src/utils/email.js"]
UtilsLogger["src/utils/logger.js"]
DBPostgres["database/db.js<br/>PostgreSQL"]
end
HTML --> JSMain
HTML --> JSStore
HTML --> JSCart
HTML --> JSCheckout
JSStore --> RoutesProducts
JSCheckout --> RoutesPayment
JSCheckout --> RoutesOrders
JSCheckout --> RoutesAuth
JSCheckout --> RoutesAdmin
Server --> RoutesProducts
Server --> RoutesOrders
Server --> RoutesPayment
Server --> RoutesAuth
Server --> RoutesAdmin
Server --> UtilsEmail
Server --> UtilsLogger
Server --> DBPostgres
```

**Diagram sources**
- [server.js:1-800](file://server.js#L1-L800)
- [src/main.js:1-405](file://src/main.js#L1-L405)
- [src/store.js:1-333](file://src/store.js#L1-L333)
- [src/cartManager.js:1-91](file://src/cartManager.js#L1-L91)
- [src/checkout.js:1-448](file://src/checkout.js#L1-L448)
- [src/routes/products.js:1-133](file://src/routes/products.js#L1-L133)
- [src/routes/orders.js:1-411](file://src/routes/orders.js#L1-L411)
- [src/routes/payment.js:1-154](file://src/routes/payment.js#L1-L154)
- [src/routes/auth.js:1-54](file://src/routes/auth.js#L1-L54)
- [src/routes/admin.js:1-140](file://src/routes/admin.js#L1-L140)
- [src/utils/email.js:1-433](file://src/utils/email.js#L1-L433)
- [src/utils/logger.js:1-67](file://src/utils/logger.js#L1-L67)
- [database/db.js:1-267](file://database/db.js#L1-L267)

**Section sources**
- [README.md:1-3](file://README.md#L1-L3)
- [package.json:1-33](file://package.json#L1-L33)

## Core Components
- Express server with rate limiting, CORS, and request logging
- Product catalog integration with Gym Master API and caching
- Shopping cart with localStorage persistence
- Checkout flow with member/new customer options, stock validation, and Paystack payment initiation
- Order management with file-based and MongoDB fallback, plus optional PostgreSQL
- Admin authentication with TOTP and QR setup
- Email notifications via Brevo transactional emails
- Logging with Winston and serverless-friendly file logging

**Section sources**
- [server.js:1-800](file://server.js#L1-L800)
- [src/routes/products.js:1-133](file://src/routes/products.js#L1-L133)
- [src/cartManager.js:1-91](file://src/cartManager.js#L1-L91)
- [src/checkout.js:1-448](file://src/checkout.js#L1-L448)
- [src/routes/orders.js:1-411](file://src/routes/orders.js#L1-L411)
- [src/routes/admin.js:1-140](file://src/routes/admin.js#L1-L140)
- [src/utils/email.js:1-433](file://src/utils/email.js#L1-L433)
- [src/utils/logger.js:1-67](file://src/utils/logger.js#L1-L67)
- [database/db.js:1-267](file://database/db.js#L1-L267)

## Architecture Overview
The system is a hybrid backend with optional persistence layers:
- Primary persistence: file-based JSON storage for orders
- Secondary persistence: MongoDB for orders and optional PostgreSQL for advanced features
- Frontend communicates with backend routes for products, orders, payments, and admin functions
- Gym Master API integration for membership checks, prospect creation, and product catalogs
- Brevo integration for order confirmation and status update emails

```mermaid
graph TB
Client["Browser"]
Server["Express Server<br/>server.js"]
ProductsRoute["Products Route<br/>src/routes/products.js"]
OrdersRoute["Orders Route<br/>src/routes/orders.js"]
PaymentRoute["Payment Route<br/>src/routes/payment.js"]
AuthRoute["Auth Route<br/>src/routes/auth.js"]
AdminRoute["Admin Route<br/>src/routes/admin.js"]
EmailUtil["Email Utility<br/>src/utils/email.js"]
LoggerUtil["Logger Utility<br/>src/utils/logger.js"]
Mongo["MongoDB"]
Postgres["PostgreSQL Pool<br/>database/db.js"]
Client --> Server
Server --> ProductsRoute
Server --> OrdersRoute
Server --> PaymentRoute
Server --> AuthRoute
Server --> AdminRoute
Server --> EmailUtil
Server --> LoggerUtil
OrdersRoute --> Mongo
OrdersRoute --> Postgres
```

**Diagram sources**
- [server.js:1-800](file://server.js#L1-L800)
- [src/routes/products.js:1-133](file://src/routes/products.js#L1-L133)
- [src/routes/orders.js:1-411](file://src/routes/orders.js#L1-L411)
- [src/routes/payment.js:1-154](file://src/routes/payment.js#L1-L154)
- [src/routes/auth.js:1-54](file://src/routes/auth.js#L1-L54)
- [src/routes/admin.js:1-140](file://src/routes/admin.js#L1-L140)
- [src/utils/email.js:1-433](file://src/utils/email.js#L1-L433)
- [src/utils/logger.js:1-67](file://src/utils/logger.js#L1-L67)
- [database/db.js:1-267](file://database/db.js#L1-L267)

## Detailed Component Analysis

### Product Catalog Integration
The product catalog fetches data from Gym Master, caches it, filters out delivery/pickup items, and exposes stock-check endpoints.

```mermaid
sequenceDiagram
participant Client as "Client Browser"
participant StoreJS as "src/store.js"
participant ProductsRoute as "src/routes/products.js"
participant GymMaster as "Gym Master API"
Client->>StoreJS : "DOMContentLoaded"
StoreJS->>ProductsRoute : "GET /api/products"
ProductsRoute->>GymMaster : "Fetch products"
GymMaster-->>ProductsRoute : "Products JSON"
ProductsRoute-->>StoreJS : "Filtered products"
StoreJS-->>Client : "Render product cards"
```

**Diagram sources**
- [src/store.js:14-98](file://src/store.js#L14-L98)
- [src/routes/products.js:53-91](file://src/routes/products.js#L53-L91)

**Section sources**
- [src/routes/products.js:1-133](file://src/routes/products.js#L1-L133)
- [src/store.js:1-333](file://src/store.js#L1-L333)

### Shopping Cart Management
The cart persists in localStorage, validates stock limits, and updates UI counters.

```mermaid
classDiagram
class ShoppingCart {
+addItem(product)
+updateCartCount()
+saveCart()
+loadCart()
+showNotification(message, type)
}
```

**Diagram sources**
- [src/cartManager.js:1-91](file://src/cartManager.js#L1-L91)

**Section sources**
- [src/cartManager.js:1-91](file://src/cartManager.js#L1-L91)

### Checkout and Payment Flow
The checkout validates stock, handles new/existing members, creates prospects, initiates Paystack payments, and manages order persistence.

```mermaid
sequenceDiagram
participant Client as "Client Browser"
participant CheckoutJS as "src/checkout.js"
participant Server as "server.js"
participant OrdersRoute as "src/routes/orders.js"
participant PaymentRoute as "src/routes/payment.js"
participant Paystack as "Paystack API"
Client->>CheckoutJS : "Submit order"
CheckoutJS->>Server : "POST /api/products/check-stock"
Server-->>CheckoutJS : "Stock validation result"
CheckoutJS->>Server : "POST /api/prospect/create or /api/login"
Server-->>CheckoutJS : "Token or login result"
CheckoutJS->>Server : "POST /api/orders"
Server-->>CheckoutJS : "Order created"
CheckoutJS->>Server : "POST /api/purchase"
Server->>Paystack : "Initialize payment"
Paystack-->>Server : "Authorization URL"
Server-->>CheckoutJS : "Authorization URL"
CheckoutJS-->>Client : "Redirect to Paystack"
```

**Diagram sources**
- [src/checkout.js:149-448](file://src/checkout.js#L149-L448)
- [src/routes/orders.js:216-271](file://src/routes/orders.js#L216-L271)
- [src/routes/payment.js:31-110](file://src/routes/payment.js#L31-L110)
- [server.js:760-800](file://server.js#L760-L800)

**Section sources**
- [src/checkout.js:1-448](file://src/checkout.js#L1-L448)
- [src/routes/orders.js:1-411](file://src/routes/orders.js#L1-L411)
- [src/routes/payment.js:1-154](file://src/routes/payment.js#L1-L154)
- [server.js:1-800](file://server.js#L1-L800)

### Order Management and Persistence
The system supports file-based, MongoDB, and PostgreSQL persistence with fallback mechanisms and TOTP-protected deletion.

```mermaid
flowchart TD
Start(["Order Received"]) --> CheckDB["Check DB Config<br/>MongoDB/PostgreSQL"]
CheckDB --> |Available| SaveDB["Save to DB"]
CheckDB --> |Unavailable| SaveFile["Save to file"]
SaveDB --> UpdateStatus["Update Status"]
SaveFile --> UpdateStatus
UpdateStatus --> Notify["Send Email (optional)"]
Notify --> End(["Done"])
```

**Diagram sources**
- [src/routes/orders.js:53-85](file://src/routes/orders.js#L53-L85)
- [server.js:160-250](file://server.js#L160-L250)
- [database/db.js:66-240](file://database/db.js#L66-L240)

**Section sources**
- [src/routes/orders.js:1-411](file://src/routes/orders.js#L1-L411)
- [server.js:106-250](file://server.js#L106-L250)
- [database/db.js:1-267](file://database/db.js#L1-L267)

### Admin Authentication and Security
Admin login uses TOTP with QR setup and rate limiting to prevent brute-force attacks.

```mermaid
sequenceDiagram
participant Admin as "Admin User"
participant AdminRoute as "src/routes/admin.js"
participant Server as "server.js"
participant TOTP as "TOTP Generator"
Admin->>AdminRoute : "POST /api/admin/login"
AdminRoute->>TOTP : "Verify 6-digit code"
TOTP-->>AdminRoute : "Validation result"
AdminRoute-->>Admin : "Success/Failure"
Admin->>Server : "GET /api/admin/setup"
Server-->>Admin : "QR codes and secrets"
```

**Diagram sources**
- [src/routes/admin.js:10-38](file://src/routes/admin.js#L10-L38)
- [server.js:382-398](file://server.js#L382-L398)

**Section sources**
- [src/routes/admin.js:1-140](file://src/routes/admin.js#L1-L140)
- [server.js:359-435](file://server.js#L359-L435)

### Email Notifications
Emails are sent via Brevo for order confirmations and status updates with robust error handling.

```mermaid
classDiagram
class EmailUtility {
+sendOrderConfirmationEmail(customerEmail, orderDetails)
+sendStatusUpdateEmail(customerEmail, orderDetails, newStatus)
+isConfigured()
}
```

**Diagram sources**
- [src/utils/email.js:428-432](file://src/utils/email.js#L428-L432)

**Section sources**
- [src/utils/email.js:1-433](file://src/utils/email.js#L1-L433)

## Dependency Analysis
Key runtime dependencies include Express, MongoDB driver, Paystack SDK, Brevo email, rate limiting, and Winston logging.

```mermaid
graph LR
Server["server.js"] --> Express["express"]
Server --> Cors["cors"]
Server --> RateLimit["express-rate-limit"]
Server --> Mongo["mongodb"]
Server --> Brevo["@getbrevo/brevo"]
Server --> QR["qrcode"]
Server --> Speakeasy["speakeasy"]
Server --> Winston["winston"]
Server --> Dotenv["dotenv"]
Server --> MySQL2["mysql2"]
```

**Diagram sources**
- [package.json:19-31](file://package.json#L19-L31)
- [server.js:1-15](file://server.js#L1-L15)

**Section sources**
- [package.json:1-33](file://package.json#L1-L33)
- [server.js:1-26](file://server.js#L1-L26)

## Performance Considerations
- Product caching reduces Gym Master API calls and improves load times
- Rate limiting protects endpoints from abuse
- LocalStorage cart avoids server round-trips for client-side cart operations
- Optional MongoDB and PostgreSQL provide scalable persistence with fallbacks
- Request logging helps monitor performance and detect bottlenecks

## Troubleshooting Guide
Common issues and resolutions:
- Gym Master API credentials missing: Configure environment variables for API key, base URL, and company ID
- MongoDB connection failures: Verify URI and credentials; fallback to file storage is automatic
- Paystack payment initialization errors: Check secret key and network connectivity
- Email delivery failures: Confirm Brevo API key and sender configuration
- Admin TOTP setup: Use the QR setup endpoint to configure authenticator apps

**Section sources**
- [src/routes/products.js:56-64](file://src/routes/products.js#L56-L64)
- [server.js:106-158](file://server.js#L106-L158)
- [src/routes/payment.js:65-91](file://src/routes/payment.js#L65-L91)
- [src/utils/email.js:25-38](file://src/utils/email.js#L25-L38)
- [src/routes/admin.js:40-137](file://src/routes/admin.js#L40-L137)

## Conclusion
This laundry services platform combines a responsive frontend with a robust backend that integrates with Gym Master, supports secure payments via Paystack, and provides comprehensive order management with optional persistence layers. The modular design, security measures, and extensible utilities make it suitable for scaling and maintenance.