# Auspify Atelier // Engineered Goods & Architectural Hardware

Full-stack precision e-commerce platform engineered for spatial architecture, CNC-machined hardware, and acoustic reference monitoring devices. Built with an editorial layout-driven aesthetic inspired by the Prashant on Behance portfolio systems, Bauhaus constructivism, asymmetrical specimen grids, sharp rectangular framing, and a robust FastAPI backend.

---

## 1. Architectural Design Template & Color System

The platform features an engineered editorial design system adhering to strict industrial product aesthetic standards:

* **Multi-Color Architectural Functional Palette**:
  * **Primary Canvas**: Deep Matte Basalt (`#0A0B0E`) with Precision Graphite surfaces (`#111319` and `#151821`).
  * **International Signal Orange (`#FF4400`)**: Core actions, primary buttons, active markers, and catalog highlights.
  * **Drafting Cobalt & Sky Titanium (`#2563EB` / `#38BDF8`)**: Acoustics & Audio Architecture classification (`CAT-01`), domain metadata, and telemetry.
  * **Cadmium Horological Gold (`#F59E0B`)**: Chronometry & Instrumentation classification (`CAT-03`), dimensions, and warranty seals.
  * **Radiant Telemetry Emerald (`#10B981`)**: Architectural Luminaires classification (`CAT-04`), live stock counters, and system integrity indicators.
  * **Terracotta Stoneware Ochre (`#EA580C`)**: Ceramic & Monolithic Objects classification (`CAT-05`).
  * **Blueprint Caliper Cyan (`#06B6D4`)**: Material specifications and assembled order status.
  * **Warm Alabaster Bone (`#F5F4EE`)**: High-contrast inverted poster blocks, typography panels, and primary button base.
  * **Zero Synthetic/Purple Gradients**: Strictly no generic dark-mode SaaS purple glows or gradient blobs.
* **Structural Blueprint Grid**:
  * Visible 1px architectural grid lines separating sections, columns, and cards.
  * Category spectrum palette strip allowing one-click classification filtering.
  * Structural catalog specimen numbering (`#01`, `#02`, `#03`...) with category-coded badge blocks.
  * Architectural viewfinder framing with corner crosshairs on image displays.
* **Strict 0px Rectangular Framing**: Sharp, geometric framing with 0px radii. Strictly zero pill-shaped buttons.
* **Typographic Rigor**: High-contrast pairing of *Space Grotesk* for bold architectural display headers, *Plus Jakarta Sans* for editorial body copy, and *JetBrains Mono* for engineering specifications, SKUs, tolerances, and metallurgical metadata.
* **Authentic Provenance & Specs**: Realistic physical design objects (beryllium monitors, mechanical typing interfaces, surgical steel chronometers) with verified dimensional specifications, materials, and origin facilities. Zero fake reviews, zero fake customer counters, zero artificial urgency timers.
* **Clean Editorial Copy**: Precise technical punctuation with clean hyphens and colons. Zero em dashes (no em dash characters permitted).

---

## 2. Directory Structure

```text
Ecommerce_Platform_Development/
├── app/
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css            # Bauhaus & Behance-inspired editorial design system
│   │   ├── js/
│   │   │   └── app.js               # Reactive client state, cart engine, admin CRUD
│   │   ├── favicon.svg              # Geometric monogram SVG with Signal Orange crosshair
│   │   └── favicon.ico              # Multi-resolution ICO fallback
│   ├── templates/
│   │   ├── index.html               # Main catalog storefront & interactive drawers
│   │   ├── privacy.html             # Fully formatted, compliant Privacy Policy page
│   │   └── terms.html               # Fully formatted, compliant Terms of Sale page
│   ├── auth.py                      # Cryptographic session management & bcrypt hashing
│   ├── config.py                    # Environment settings & custom domain parameters
│   ├── crud.py                      # Database operations, cart math, integrity verification
│   ├── database.py                  # SQLAlchemy engine & session dependency
│   ├── main.py                      # FastAPI application routes & API endpoints
│   ├── models.py                    # Relational schema (Products, Orders, Carts, Users)
│   ├── schemas.py                   # Pydantic request/response validation schemas
│   └── seed.py                      # Production catalog baseline dataset
├── tests/
│   └── test_ecommerce.py            # Complete 9-point end-to-end test suite
├── requirements.txt                 # Pinned Python package dependencies
├── run.py                           # Development server launch script
├── run_tests.py                     # Test runner script
└── ecommerce.db                     # SQLite production database instance
```

---

## 3. Core Task Workflow Implementation

### Step 1: Product Listing & Browsing
* **Dynamic Catalog Filter**: Filter by product classification (Acoustics, Workstation, Chronometry, Lighting, Ceramic).
* **Full-Text Real-Time Search**: Search across SKU tags, product names, and metallurgical descriptions with debounced input.
* **Multi-Parameter Sorting**: Curated index, price low-to-high, price high-to-low, alphabetical, and chronological release.
* **Stock Availability**: Instant toggle for in-stock units with clear status tags (`STOCK: N UNITS`, `LOW STOCK`, `OUT OF STOCK`).
* **Technical Datasheet Modal**: Multi-angle product imagery, detailed material specifications (metallurgy, dimensions, net mass, surface finish, facility of origin), and quantity selector.

### Step 2: Product Management APIs
* `GET /api/products`: Query catalog items with pagination, category filter, price bounds, and stock filters.
* `GET /api/products/{id_or_slug}`: Retrieve full product metadata by integer ID or URL slug.
* `POST /api/products`: Administrative creation of new inventory records with technical specifications.
* `PUT /api/products/{id}`: Update product pricing and metadata.
* `POST /api/products/{id}/stock`: Atomically adjust stock quantities with positive or negative deltas.
* `DELETE /api/products/{id}`: Soft or hard deletion of catalog records.
* `GET /api/categories`: Fetch active categories with product counts.

### Step 3: Shopping Cart Engine
* **Persistent Sessions**: Cart items linked via persistent session tokens in localStorage and cookies.
* **Dynamic Calculations**: Real-time server-side computation of subtotal, tax (8.25%), tiered freight ($0 for orders over $250, $15 standard, $35 express), and voucher deductions.
* **Voucher Support**: Active coupon code validation (`ATELIER10` for 10% discount, `FREIGHT2026` for free air cargo).
* **Interactive Slide-Over Drawer**: Modify line quantities, remove items, view itemized charges, and launch checkout.

### Step 4: Orders & User Account Management
* **Authentication**: Salted bcrypt password hashing with secure HTTP-only session cookies.
* **Role-Based Access Control**: Separate permissions for standard customers and administrative personnel.
* **Checkout Pipeline**: Real-time inventory verification, atomic stock deduction, order record persistence with unique tracking numbers (`ORD-YYYYMM-XXXXXX`), and cart clearance.
* **Customer Order History**: Logged-in customers can inspect past dispatches, item breakdown, and status progression.
* **Executive Order Pipeline**: Administrators can manage order fulfillment status across 5 discrete lifecycle states: `Processing` -> `Assembled` -> `Dispatched` -> `Delivered` -> `Cancelled`.

### Step 5: End-to-End Testing & Verification
* Automated test suite in `tests/test_ecommerce.py` covering:
  1. Hard launch criteria and deployment lock verification.
  2. Formatting and delivery of `/privacy` and `/terms` legal pages.
  3. Favicon asset endpoints (`/favicon.svg` and `/favicon.ico`).
  4. Product listing, filtering, search, and price sorting.
  5. Product detail inspection via ID and slug routes.
  6. Admin product lifecycle (create, update price, adjust stock, delete).
  7. Shopping cart operations and freight/tax/promo computations.
  8. Customer registration and session authentication.
  9. End-to-end checkout, atomic stock reduction, and order generation.

---

## 4. Hard Launch Criteria Compliance (Deployment Lock)

| Baseline Criterion | Target Standard | Implementation Status |
| :--- | :--- | :--- |
| **1. Custom Domain** | Verified custom domain connected | **SATISFIED**: Configured to `commerce.auspify.internal` |
| **2. Custom Favicon** | Custom architectural favicon active | **SATISFIED**: Signal Orange & Bone vector SVG + multi-res ICO served |
| **3. Zero AI Badges** | Generated attribution tags stripped | **SATISFIED**: Complete audit performed across all files |
| **4. Privacy Policy** | Formatted live compliance page | **SATISFIED**: Accessible at `/privacy` with GDPR/CCPA terms |
| **5. Terms & Conditions** | Formatted live commercial sale terms | **SATISFIED**: Accessible at `/terms` with warranty and arbitration |

Endpoint `/api/system/integrity` continuously audits these five criteria in real time. When all conditions are satisfied, `deployment_locked` is set to `false`.

---

## 5. Execution Instructions

### Setup and Running the Server
```bash
cd Ecommerce_Platform_Development
pip install -r requirements.txt
python run.py
```
Open `http://127.0.0.1:8000` in your browser.

### Demo Credentials
* **Customer Account**: Username: `shopper_client` | Password: `Password123!`
* **Administrator Account**: Username: `atelier_admin` | Password: `Password123!`

### Running the Test Suite
```bash
cd Ecommerce_Platform_Development
python run_tests.py
```
