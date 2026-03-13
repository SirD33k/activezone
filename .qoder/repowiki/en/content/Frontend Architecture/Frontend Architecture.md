# Frontend Architecture

<cite>
**Referenced Files in This Document**
- [index.html](file://index.html)
- [store.html](file://store.html)
- [cart.html](file://cart.html)
- [orders.html](file://orders.html)
- [src/main.js](file://src/main.js)
- [src/layout.js](file://src/layout.js)
- [src/store.js](file://src/store.js)
- [src/cartManager.js](file://src/cartManager.js)
- [src/cart.js](file://src/cart.js)
- [src/checkout.js](file://src/checkout.js)
- [src/gallery.js](file://src/gallery.js)
- [src/style.css](file://src/style.css)
- [src/routes/orders.js](file://src/routes/orders.js)
- [vite.config.js](file://vite.config.js)
- [package.json](file://package.json)
</cite>

## Update Summary
**Changes Made**
- Enhanced mobile responsiveness system documentation with comprehensive CSS media queries
- Added responsive button sizing and touch target accessibility improvements
- Documented extensive mobile UX optimizations across all page types
- Updated responsive design patterns to reflect modern mobile-first approach
- Added touch-friendly interface elements and improved mobile navigation

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Mobile Responsiveness System](#mobile-responsiveness-system)
7. [Dependency Analysis](#dependency-analysis)
8. [Performance Considerations](#performance-considerations)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Conclusion](#conclusion)

## Introduction
This document describes the frontend architecture of Active Zone Hub's client-side implementation. It focuses on the modular JavaScript structure, application initialization, interactive systems (carousel, navigation, forms), shopping cart architecture, store frontend, layout management, responsive design patterns, and frontend-to-backend communication. The system now features a comprehensive mobile responsiveness system with extensive CSS media queries, responsive button sizing, touch target accessibility improvements, and enhanced mobile UX optimizations.

## Project Structure
The frontend is organized around single-page HTML templates per major route, with shared styles and modular JavaScript modules. Vite is configured to build multiple entry points mapped to each HTML page. Styles are centralized in a single stylesheet with theme variables and responsive breakpoints. The mobile-first approach ensures optimal performance across all device sizes.

```mermaid
graph TB
subgraph "Entry Pages"
Home["index.html"]
Store["store.html"]
Cart["cart.html"]
Orders["orders.html"]
Checkout["checkout.html"]
Gallery["gallery.html"]
end
subgraph "Shared Assets"
Style["src/style.css"]
ViteCfg["vite.config.js"]
Package["package.json"]
end
subgraph "Modules"
Main["src/main.js"]
Layout["src/layout.js"]
StoreJS["src/store.js"]
CartMgr["src/cartManager.js"]
CartPage["src/cart.js"]
CheckoutJS["src/checkout.js"]
GalleryJS["src/gallery.js"]
OrdersRoute["src/routes/orders.js"]
end
Home --> Main
Store --> StoreJS
Store --> CartMgr
Cart --> CartMgr
Cart --> CartPage
Orders --> OrdersRoute
Checkout --> CheckoutJS
Checkout --> CartMgr
Gallery --> GalleryJS
Main --> Layout
Main --> Style
StoreJS --> Style
CartPage --> Style
CheckoutJS --> Style
GalleryJS --> Style
OrdersRoute --> Style
```

**Diagram sources**
- [index.html:1-325](file://index.html#L1-L325)
- [store.html:1-854](file://store.html#L1-L854)
- [cart.html:1-144](file://cart.html#L1-L144)
- [orders.html:1-1204](file://orders.html#L1-L1204)
- [src/main.js:1-405](file://src/main.js#L1-L405)
- [src/layout.js:1-93](file://src/layout.js#L1-L93)
- [src/store.js:1-316](file://src/store.js#L1-L316)
- [src/cartManager.js:1-91](file://src/cartManager.js#L1-L91)
- [src/cart.js:1-156](file://src/cart.js#L1-L156)
- [src/checkout.js:1-438](file://src/checkout.js#L1-L438)
- [src/gallery.js:1-169](file://src/gallery.js#L1-L169)
- [src/routes/orders.js:1-405](file://src/routes/orders.js#L1-L405)
- [src/style.css:1-3800](file://src/style.css#L1-L3800)
- [vite.config.js:1-20](file://vite.config.js#L1-L20)

**Section sources**
- [index.html:1-325](file://index.html#L1-L325)
- [store.html:1-854](file://store.html#L1-L854)
- [cart.html:1-144](file://cart.html#L1-L144)
- [orders.html:1-1204](file://orders.html#L1-L1204)
- [vite.config.js:1-20](file://vite.config.js#L1-L20)
- [package.json:1-28](file://package.json#L1-L28)

## Core Components
- Application bootstrap and global enhancements: Carousel, mobile navigation, scroll animations, lazy images, contact form, membership tabs, and scroll-to-top.
- Store frontend: Dynamic product fetching, filtering, category mapping, and add-to-cart integration.
- Shopping cart: Persistent state via localStorage, cart toolbar updates, and cart page rendering.
- Checkout: Member type selection, delivery options, stock validation, and order submission.
- Gallery: Filtering and lightbox with keyboard navigation.
- Layout injection: Shared navbar and footer across pages.
- Orders management: Comprehensive order tracking, status updates, CSV export, and inventory management with auto-refresh capabilities.
- **Enhanced Mobile Responsiveness**: Comprehensive CSS media queries system, responsive button sizing, touch target accessibility, and mobile UX optimizations.

**Section sources**
- [src/main.js:1-405](file://src/main.js#L1-L405)
- [src/store.js:1-316](file://src/store.js#L1-L316)
- [src/cartManager.js:1-91](file://src/cartManager.js#L1-L91)
- [src/cart.js:1-156](file://src/cart.js#L1-L156)
- [src/checkout.js:1-438](file://src/checkout.js#L1-L438)
- [src/gallery.js:1-169](file://src/gallery.js#L1-L169)
- [src/layout.js:1-93](file://src/layout.js#L1-L93)
- [orders.html:1-1204](file://orders.html#L1-L1204)
- [src/routes/orders.js:1-405](file://src/routes/orders.js#L1-L405)
- [src/style.css:1338-1466](file://src/style.css#L1338-L1466)

## Architecture Overview
The frontend follows a modular pattern with enhanced mobile responsiveness:
- Entry pages include only the scripts they need.
- Shared modules encapsulate reusable logic (cart manager, layout).
- Store and cart pages depend on the shared cart manager for persistence.
- Checkout integrates with the cart manager and performs backend validation and submission.
- Orders page implements sophisticated initialization with DOM readiness checking and auto-refresh mechanisms.
- Styles are centralized and theme-driven with CSS variables and comprehensive mobile media queries.
- **Mobile-first design**: Extensive responsive breakpoints and touch-friendly interfaces.

```mermaid
graph TB
subgraph "Entry Scripts"
M["src/main.js"]
S["src/store.js"]
CM["src/cartManager.js"]
C["src/cart.js"]
CK["src/checkout.js"]
G["src/gallery.js"]
O["orders.html"]
OR["src/routes/orders.js"]
end
subgraph "UI Templates"
H["index.html"]
ST["store.html"]
CA["cart.html"]
ORD["orders.html"]
CH["checkout.html"]
GA["gallery.html"]
end
subgraph "Responsive Styles"
CSS["src/style.css"]
CSS768["Mobile Queries @768px"]
CSS600["Mobile Queries @600px"]
end
H --> M
ST --> S
ST --> CM
CA --> CM
CA --> C
ORD --> O
ORD --> OR
CH --> CK
CH --> CM
GA --> G
M --> CSS
S --> CSS
C --> CSS
CK --> CSS
G --> CSS
O --> CSS
OR --> CSS
CSS --> CSS768
CSS --> CSS600
```

**Diagram sources**
- [src/main.js:1-405](file://src/main.js#L1-L405)
- [src/store.js:1-316](file://src/store.js#L1-L316)
- [src/cartManager.js:1-91](file://src/cartManager.js#L1-L91)
- [src/cart.js:1-156](file://src/cart.js#L1-L156)
- [src/checkout.js:1-438](file://src/checkout.js#L1-L438)
- [src/gallery.js:1-169](file://src/gallery.js#L1-L169)
- [orders.html:1-1204](file://orders.html#L1-L1204)
- [src/routes/orders.js:1-405](file://src/routes/orders.js#L1-L405)
- [src/style.css:1338-1466](file://src/style.css#L1338-L1466)

## Detailed Component Analysis

### Application Initialization and Global Enhancements (src/main.js)
Responsibilities:
- Carousel: Automatic rotation, manual controls, indicator clicks, pause on hover.
- Navigation: Mobile hamburger menu with animated bars and automatic collapse on link click.
- Scroll animations: IntersectionObserver-based fade-in effects.
- Membership tabs: Switch between plan categories.
- Navbar scroll effect: Sticky header with background change on scroll.
- Scroll-to-top button: Visibility and smooth scroll behavior.
- Lazy images: IntersectionObserver-based loading.
- External links: Automatic target and rel attributes for cross-origin links.
- Preconnect: Fonts preconnect for performance.
- Structured data: JSON-LD for SEO.
- Contact form: Async submission via fetch with loading states and feedback.

```mermaid
sequenceDiagram
participant Doc as "DOMContentLoaded"
participant Car as "Carousel"
participant Nav as "Mobile Nav"
participant Obs as "IntersectionObserver"
participant Form as "Contact Form"
Doc->>Car : Initialize slides and indicators
Doc->>Nav : Bind hamburger toggle and link clicks
Doc->>Obs : Observe elements for animate-in
Doc->>Form : Attach submit handler
Form->>Form : Validate and disable submit
Form->>Backend : fetch("/api/contact")
Backend-->>Form : JSON result
Form->>Form : Show success/error message
Form->>Form : Re-enable submit and reset text
```

**Diagram sources**
- [src/main.js:1-405](file://src/main.js#L1-L405)

**Section sources**
- [src/main.js:1-405](file://src/main.js#L1-L405)

### Layout Management (src/layout.js)
Responsibilities:
- Injects a shared navbar and footer into the DOM.
- Initializes mobile menu toggle logic after injection.

```mermaid
flowchart TD
Start(["injectLayout()"]) --> CreateNavbar["Create navbar element"]
CreateNavbar --> CreateFooter["Create footer element"]
CreateFooter --> InsertNav["Insert navbar at beginning of #app"]
InsertNav --> InsertFooter["Append footer at end of #app"]
InsertFooter --> InitMenu["initMenuToggle()"]
InitMenu --> End(["Done"])
```

**Diagram sources**
- [src/layout.js:1-93](file://src/layout.js#L1-L93)

**Section sources**
- [src/layout.js:1-93](file://src/layout.js#L1-L93)

### Store Frontend (src/store.js)
Responsibilities:
- Fetch and render products from the backend API with a conservative fallback to static content.
- Filter products by category and hide/show cards.
- Map product names/groups to categories for filtering.
- Format prices and handle low-stock badges.
- Attach add-to-cart listeners and integrate with the shared cart manager.

```mermaid
sequenceDiagram
participant Page as "Store Page"
participant API as "Products API"
participant DOM as "Products Grid"
Page->>API : fetch(API_BASE + "/products")
API-->>Page : {success, products[]}
Page->>Page : Filter delivery/pickup and zero stock
Page->>DOM : renderProducts(filtered)
DOM-->>Page : attachAddToCartListeners()
Page->>CartMgr : cart.addItem(product)
```

**Diagram sources**
- [src/store.js:12-165](file://src/store.js#L12-L165)

**Section sources**
- [src/store.js:1-316](file://src/store.js#L1-L316)
- [store.html:1-854](file://store.html#L1-L854)

### Shopping Cart System (src/cartManager.js + src/cart.js)
Responsibilities:
- Persistent state management via localStorage.
- Add/remove/update quantities and max stock enforcement.
- Update cart toolbar counts and notifications.
- Cart page rendering, quantity adjustments, and removal with user feedback.

```mermaid
classDiagram
class ShoppingCart {
+items : Array
+constructor()
+loadCart() : Array
+saveCart() : void
+addItem(product) : void
+updateCartCount() : void
+showNotification(message, type) : void
}
class CartPage {
+renderCart() : void
+createCartItemElement(item, index) : HTMLElement
+updateCartSummary() : void
+showNotification(message, type) : void
}
ShoppingCart <.. CartPage : "used by"
```

**Diagram sources**
- [src/cartManager.js:1-91](file://src/cartManager.js#L1-L91)
- [src/cart.js:1-156](file://src/cart.js#L1-L156)

**Section sources**
- [src/cartManager.js:1-91](file://src/cartManager.js#L1-L91)
- [src/cart.js:1-156](file://src/cart.js#L1-L156)
- [cart.html:1-144](file://cart.html#L1-L144)

### Checkout Workflow (src/checkout.js)
Responsibilities:
- Member type toggling (new vs existing).
- Delivery method selection and dynamic address fields.
- Stock validation against backend before order placement.
- Prospect creation and member login flows.
- Order submission with totals calculation and redirection to payment.

```mermaid
sequenceDiagram
participant User as "User"
participant Page as "Checkout Page"
participant Stock as "Stock Validation API"
participant Member as "Member APIs"
participant Orders as "Orders API"
User->>Page : Submit checkout form
Page->>Stock : POST /products/check-stock
Stock-->>Page : {success, outOfStock[], insufficient[]}
alt Out of stock or insufficient
Page->>Page : Update cart and reload
end
alt New member
Page->>Member : POST /prospect/create
Member-->>Page : {token, prospectId}
Page->>Member : POST /member/profile/update
else Existing member
Page->>Member : POST /login
Member-->>Page : {token, memberId, sessionId}
end
Page->>Orders : POST /orders
Orders-->>Page : {success, paymentUrl or orderId}
Page->>User : Redirect or alert
```

**Diagram sources**
- [src/checkout.js:147-436](file://src/checkout.js#L147-L436)

**Section sources**
- [src/checkout.js:1-438](file://src/checkout.js#L1-L438)

### Orders Management System (orders.html + src/routes/orders.js)
Responsibilities:
- Comprehensive order tracking with status management and real-time updates.
- Authentication system with session-based access control.
- Advanced filtering and search capabilities with debounced input handling.
- CSV export functionality with configurable filters.
- Auto-refresh mechanisms for continuous monitoring.
- Inventory management with stock level tracking.
- Notification system for user feedback.

**Updated** Enhanced with sophisticated initialization system featuring DOM readiness checking, double initialization prevention, and controlled auto-refresh mechanisms.

```mermaid
sequenceDiagram
participant DOM as "DOM Ready State"
participant Init as "initOrders()"
participant Auth as "Authentication Check"
participant Orders as "Orders Loading"
participant Inventory as "Inventory Loading"
participant Timer as "Auto Refresh Timer"
DOM->>Init : Check document.readyState
alt DOM Loading
Init->>DOM : Wait for DOMContentLoaded
DOM-->>Init : Event fired
end
Init->>Auth : checkAuth()
Auth-->>Init : Authentication result
alt Auth Success
Init->>Orders : loadOrders()
Init->>Inventory : loadInventory()
Init->>Timer : setInterval(loadOrders, 30000)
Init->>Timer : setInterval(loadInventory, 60000)
end
```

**Diagram sources**
- [orders.html:1041-1065](file://orders.html#L1041-L1065)
- [src/routes/orders.js:213-268](file://src/routes/orders.js#L213-L268)

**Section sources**
- [orders.html:1-1204](file://orders.html#L1-L1204)
- [src/routes/orders.js:1-405](file://src/routes/orders.js#L1-L405)

### Gallery Filtering and Lightbox (src/gallery.js)
Responsibilities:
- Filter gallery items by category.
- Open/close lightbox and navigate images with mouse, keyboard, and arrows.

```mermaid
flowchart TD
Start(["DOMContentLoaded"]) --> BindFilters["Bind filter buttons"]
BindFilters --> ClickFilter{"Filter clicked?"}
ClickFilter --> |Yes| UpdateActive["Update active button"]
UpdateActive --> ShowHide["Show/hide items by category"]
ClickFilter --> |No| End(["Idle"])
ShowHide --> End
```

**Diagram sources**
- [src/gallery.js:14-59](file://src/gallery.js#L14-L59)

**Section sources**
- [src/gallery.js:1-169](file://src/gallery.js#L1-L169)

## Mobile Responsiveness System

### Comprehensive CSS Media Queries
The system implements extensive mobile-first responsive design with strategic breakpoints:

**Primary Mobile Breakpoints:**
- **768px breakpoint**: Major layout transformations for tablets and larger phones
- **600px breakpoint**: Additional refinements for smaller mobile devices
- **Variable-based responsive units**: Flexible sizing using CSS custom properties

**Key Responsive Features:**
- **Hero Carousel**: Reduced font sizes, adjusted button positioning, and scaled controls
- **Navigation System**: Full-screen mobile menu with animated hamburger transform
- **Product Grids**: Adaptive grid layouts with auto-fit and minmax constraints
- **Contact Forms**: Single-column layout with appropriately sized form elements
- **Membership Plans**: Stacked layouts for mobile viewing
- **Gallery Masonry**: Responsive grid with flexible column widths

### Touch Target Accessibility Improvements
- **Minimum 44px touch targets**: Ensures compliance with WCAG guidelines
- **Ample spacing**: 15px+ gaps between interactive elements
- **Scalable buttons**: Responsive padding and font sizes for finger-friendly interaction
- **Touch-friendly navigation**: Expanded tap areas for menu items and buttons

### Responsive Button Sizing System
- **Consistent sizing**: All buttons use responsive padding and font scaling
- **Mobile-optimized**: Buttons increase in size for better thumb reach
- **Accessibility compliance**: Minimum 44px touch targets across all interactive elements
- **Visual hierarchy**: Appropriate contrast ratios maintained at all sizes

### Mobile UX Optimizations
- **Progressive disclosure**: Complex menus collapse to hamburger navigation
- **Flexible layouts**: Grid systems adapt to screen real estate
- **Performance optimizations**: Reduced animations and simplified effects on mobile
- **Input field sizing**: Text inputs and buttons scale appropriately for mobile keyboards

**Section sources**
- [src/style.css:1338-1466](file://src/style.css#L1338-L1466)
- [src/style.css:852-856](file://src/style.css#L852-L856)
- [src/main.js:88-119](file://src/main.js#L88-L119)
- [store.html:1-200](file://store.html#L1-L200)
- [cart.html:1-144](file://cart.html#L1-L144)

## Dependency Analysis
- Entry pages depend on specific modules:
  - index.html loads src/main.js for global enhancements.
  - store.html loads src/store.js and src/cartManager.js for product display and cart integration.
  - cart.html loads src/cartManager.js and src/cart.js for cart rendering and interactions.
  - orders.html loads src/routes/orders.js for order management and backend integration.
  - checkout.html loads src/checkout.js and src/cartManager.js for checkout and order submission.
  - gallery.html loads src/gallery.js for filtering and lightbox.
- Shared dependencies:
  - src/style.css provides theming, responsive design, and mobile optimizations.
  - Vite configuration defines multiple entry points for each HTML page.

```mermaid
graph LR
Index["index.html"] --> Main["src/main.js"]
Store["store.html"] --> StoreJS["src/store.js"]
Store --> CartMgr["src/cartManager.js"]
Cart["cart.html"] --> CartMgr
Cart --> CartPage["src/cart.js"]
Orders["orders.html"] --> OrdersRoute["src/routes/orders.js"]
Checkout["checkout.html"] --> CheckoutJS["src/checkout.js"]
Checkout --> CartMgr
Gallery["gallery.html"] --> GalleryJS["src/gallery.js"]
Main --> Style["src/style.css"]
StoreJS --> Style
CartPage --> Style
CheckoutJS --> Style
GalleryJS --> Style
OrdersRoute --> Style
```

**Diagram sources**
- [index.html:1-325](file://index.html#L1-L325)
- [store.html:1-854](file://store.html#L1-L854)
- [cart.html:1-144](file://cart.html#L1-L144)
- [orders.html:1-1204](file://orders.html#L1-L1204)
- [src/main.js:1-405](file://src/main.js#L1-L405)
- [src/store.js:1-316](file://src/store.js#L1-L316)
- [src/cartManager.js:1-91](file://src/cartManager.js#L1-L91)
- [src/cart.js:1-156](file://src/cart.js#L1-L156)
- [src/checkout.js:1-438](file://src/checkout.js#L1-L438)
- [src/gallery.js:1-169](file://src/gallery.js#L1-L169)
- [src/routes/orders.js:1-405](file://src/routes/orders.js#L1-L405)
- [src/style.css:1-3800](file://src/style.css#L1-L3800)

**Section sources**
- [vite.config.js:1-20](file://vite.config.js#L1-L20)
- [package.json:1-28](file://package.json#L1-L28)

## Performance Considerations
- Resource preloading:
  - Preconnect to fonts.googleapis.com for faster font loading.
- Lazy loading:
  - IntersectionObserver-based lazy loading for images.
- Minimal DOM manipulation:
  - Batch updates (e.g., reattaching listeners after rendering).
- Conditional API usage:
  - Loading state only shown after delay; fallback to static content if API fails.
- Local storage caching:
  - Cart persistence avoids repeated network requests for cart state.
- CSS-in-JS for animations:
  - Dynamically injected styles for scroll animations.
- Build configuration:
  - Vite multi-entry builds optimize asset bundling per page.
- Auto-refresh optimization:
  - Orders refresh every 30 seconds, inventory every 60 seconds to balance responsiveness with performance.
- DOM readiness optimization:
  - Intelligent initialization prevents unnecessary processing during page load.
- **Mobile optimization**:
  - Responsive breakpoints reduce unnecessary rendering on smaller screens.
  - Touch-friendly interfaces minimize interaction overhead.
  - Progressive enhancement ensures core functionality works without JavaScript.

## Troubleshooting Guide
Common issues and resolutions:
- Carousel not rotating:
  - Verify DOM elements with expected selectors exist and intervals are started.
- Mobile menu not closing:
  - Ensure event listeners are attached and bars transforms are applied.
- Cart not updating:
  - Confirm localStorage keys match and saveCart() is called after modifications.
- Store products not loading:
  - Check API_BASE correctness and network connectivity; confirm fallback behavior.
- Checkout stock errors:
  - Review stock validation response and ensure cart updates accordingly.
- Gallery lightbox not opening:
  - Ensure visible items array is updated and lightbox elements exist.
- Orders page not initializing:
  - Check DOM readiness state and ensure ordersLoaded flag prevents double initialization.
- Auto-refresh not working:
  - Verify setInterval timers are properly set and authentication is maintained.
- CSV export failing:
  - Ensure orders are loaded and filters are properly applied before export.
- **Mobile responsiveness issues**:
  - Verify viewport meta tag is present in HTML head.
  - Check CSS media query syntax and breakpoint values.
  - Ensure touch targets meet minimum 44px requirements.
  - Test responsive layouts across different device sizes and orientations.

**Section sources**
- [src/main.js:1-405](file://src/main.js#L1-L405)
- [src/store.js:1-316](file://src/store.js#L1-L316)
- [src/cartManager.js:1-91](file://src/cartManager.js#L1-L91)
- [src/checkout.js:1-438](file://src/checkout.js#L1-L438)
- [src/gallery.js:1-169](file://src/gallery.js#L1-L169)
- [orders.html:1-1204](file://orders.html#L1-L1204)
- [src/routes/orders.js:1-405](file://src/routes/orders.js#L1-L405)
- [src/style.css:1338-1466](file://src/style.css#L1338-L1466)

## Conclusion
Active Zone Hub's frontend employs a modular, maintainable architecture with clear separation of concerns and comprehensive mobile responsiveness. Global enhancements in main.js provide consistent UX across pages, while specialized modules handle store display, cart persistence, checkout flows, gallery interactions, and comprehensive order management. The orders page implements sophisticated initialization patterns with DOM readiness checking, double initialization prevention, and controlled auto-refresh mechanisms. 

**Enhanced Mobile Experience**: The system now features a comprehensive mobile responsiveness system with extensive CSS media queries, responsive button sizing, touch target accessibility improvements, and enhanced mobile UX optimizations. Strategic breakpoints at 768px and 600px ensure optimal performance across all device sizes, while touch-friendly interfaces and progressive disclosure patterns provide intuitive navigation on mobile devices.

Centralized styling ensures cohesive theming and responsive behavior with mobile-first design principles. The design supports performance through lazy loading, preconnects, conservative API usage, intelligent initialization, optimized auto-refresh cycles, and mobile-specific optimizations with robust fallbacks for reliability. The architecture seamlessly adapts to various screen sizes while maintaining accessibility standards and user experience quality.