import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, Base, engine
from app import models
from app.auth import hash_password

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # Check if already seeded
        if db.query(models.User).filter(models.User.username == "atelier_admin").first():
            print("Database already contains seed baseline. Skipping re-seed.")
            return

        print("Seeding Auspify Atelier Commerce Engine baseline...")

        # 1. USERS
        admin_user = models.User(
            username="atelier_admin",
            email="director@auspify.internal",
            password_hash=hash_password("Password123!"),
            full_name="Marcus Vance",
            role="admin"
        )
        db.add(admin_user)

        client_user = models.User(
            username="shopper_client",
            email="elena.rostova@designworks.io",
            password_hash=hash_password("Password123!"),
            full_name="Elena Rostova",
            role="customer"
        )
        db.add(client_user)
        db.flush()

        # 2. CATEGORIES
        cat_acoustics = models.Category(
            code="CAT-01",
            name="Acoustics & Audio Architecture",
            slug="acoustics",
            description="Active reference monitors, milled acoustic baffles, and balanced signal conduits."
        )
        cat_workstation = models.Category(
            code="CAT-02",
            name="Precision Workstation Hardware",
            slug="workstation",
            description="Solid billet mechanical typing interfaces, titanium desk risers, and milled calipers."
        )
        cat_instruments = models.Category(
            code="CAT-03",
            name="Chronometry & Instrumentation",
            slug="instruments",
            description="Mechanical chronometers, calibrated desk gauges, and technical measurement devices."
        )
        cat_lighting = models.Category(
            code="CAT-04",
            name="Architectural Luminaires",
            slug="lighting",
            description="Extruded aluminum task lights with dual CRI 98 emitters and counterbalanced joints."
        )
        cat_materials = models.Category(
            code="CAT-05",
            name="Ceramic & Monolithic Objects",
            slug="materials",
            description="Brutalist slip-cast stoneware vessels, machined pen monoliths, and obsidian trays."
        )

        db.add_all([cat_acoustics, cat_workstation, cat_instruments, cat_lighting, cat_materials])
        db.flush()

        # 3. PRODUCTS
        # Unsplash high-res direct photography of authentic industrial design, electronics, and hardware
        products_data = [
            # CAT-01 Acoustics
            {
                "sku": "AP-9041-BLK",
                "name": "Atelier Monolith Active Reference Monitor",
                "slug": "monolith-active-reference-monitor",
                "category_id": cat_acoustics.id,
                "price": 680.00,
                "compare_at_price": 750.00,
                "stock": 14,
                "low_stock_threshold": 4,
                "description": "Bi-amplified near-field acoustic monitor housed in a solid CNC-machined 6061-T6 aluminum enclosure. Features beryllium dome tweeters, carbon-weave mid-bass drivers, and balanced XLR inputs for pristine audio reproduction.",
                "material": "6061-T6 Billet Aluminum & Carbon Weave",
                "dimensions": "190 x 240 x 310 mm",
                "weight": "8.4 kg per unit",
                "finish": "Bead-blasted Hard Anodized Noir",
                "origin": "Stuttgart, Germany",
                "image_url": "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=1000&q=80",
                "gallery_json": json.dumps([
                    "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1000&q=80"
                ]),
                "featured": True
            },
            {
                "sku": "AP-9044-SLV",
                "name": "Billet Aluminum Headphone Amplifier Unit",
                "slug": "billet-aluminum-headphone-amplifier",
                "category_id": cat_acoustics.id,
                "price": 420.00,
                "compare_at_price": 460.00,
                "stock": 9,
                "low_stock_threshold": 3,
                "description": "Discrete Class-A headphone amplifier with stepped attenuator potentiometer. Engineered with isolated dual-mono topology and balanced 4.4 mm Pentaconn and 6.35 mm output jacks.",
                "material": "Brushed Aerospace Aluminum",
                "dimensions": "160 x 140 x 42 mm",
                "weight": "2.1 kg",
                "finish": "Electropolished Raw Silver",
                "origin": "Basel, Switzerland",
                "image_url": "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1000&q=80",
                "gallery_json": json.dumps([
                    "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1000&q=80"
                ]),
                "featured": False
            },
            # CAT-02 Workstation
            {
                "sku": "AP-7201-GRY",
                "name": "K-75 Mechanical Typing Interface",
                "slug": "k75-mechanical-typing-interface",
                "category_id": cat_workstation.id,
                "price": 340.00,
                "compare_at_price": 380.00,
                "stock": 22,
                "low_stock_threshold": 5,
                "description": "Custom 75% mechanical input interface with gasket mounting system and copper internal counterweight. Houses hand-lubricated tactile linear switches, screw-in stabilizers, and double-shot PBT keycaps.",
                "material": "Anodized Aluminum & Solid Brass Weight",
                "dimensions": "322 x 138 x 34 mm",
                "weight": "1.85 kg",
                "finish": "Matte Slate Gray Anodize",
                "origin": "Kyoto, Japan",
                "image_url": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=80",
                "gallery_json": json.dumps([
                    "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=1000&q=80"
                ]),
                "featured": True
            },
            {
                "sku": "AP-7208-BLK",
                "name": "Machined Titanium Desk Tray System",
                "slug": "machined-titanium-desk-tray",
                "category_id": cat_workstation.id,
                "price": 145.00,
                "compare_at_price": None,
                "stock": 31,
                "low_stock_threshold": 6,
                "description": "Monolithic organization tray precision-milled from a single block of Grade 5 titanium. Laser-etched dimensional measurement grids along the perimeter for architectural drafting reference.",
                "material": "Grade 5 Titanium (Ti-6Al-4V)",
                "dimensions": "280 x 110 x 18 mm",
                "weight": "680 g",
                "finish": "Micro-peened Matte Titanium",
                "origin": "Turin, Italy",
                "image_url": "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=1000&q=80",
                "gallery_json": json.dumps([
                    "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=1000&q=80"
                ]),
                "featured": False
            },
            # CAT-03 Chronometry
            {
                "sku": "AP-4100-STEEL",
                "name": "Chronograph 01 Instrument Watch",
                "slug": "chronograph-01-instrument-watch",
                "category_id": cat_instruments.id,
                "price": 890.00,
                "compare_at_price": 950.00,
                "stock": 8,
                "low_stock_threshold": 3,
                "description": "Mechanical flyback chronograph driven by a column-wheel automatic caliber. Monolithic 316L stainless steel case with anti-reflective sapphire crystal and Bauhaus-inspired dial layout.",
                "material": "316L Surgical Stainless Steel & Sapphire",
                "dimensions": "39 mm Diameter x 11.8 mm Height",
                "weight": "115 g",
                "finish": "Vertical Brushed Satin & Polished Bezel",
                "origin": "Glashütte, Germany",
                "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80",
                "gallery_json": json.dumps([
                    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1000&q=80"
                ]),
                "featured": True
            },
            {
                "sku": "AP-4105-BRS",
                "name": "Precision Calibrated Brass Barometer",
                "slug": "precision-calibrated-brass-barometer",
                "category_id": cat_instruments.id,
                "price": 275.00,
                "compare_at_price": None,
                "stock": 12,
                "low_stock_threshold": 4,
                "description": "Desk aneroid atmospheric barometer machined from solid naval brass. Equipped with precision vacuum capsule, balance counterweights, and engraved hectopascal gauge scale.",
                "material": "Solid Naval Brass & Mineral Glass",
                "dimensions": "120 mm Base x 85 mm Height",
                "weight": "1.3 kg",
                "finish": "Raw Hand-Brushed Lacquered Brass",
                "origin": "Gothenburg, Sweden",
                "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1000&q=80",
                "gallery_json": json.dumps([
                    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1000&q=80"
                ]),
                "featured": False
            },
            # CAT-04 Lighting
            {
                "sku": "AP-6020-BLK",
                "name": "Luminaire L-04 Linear Counterbalance Task Light",
                "slug": "luminaire-l04-linear-task-light",
                "category_id": cat_lighting.id,
                "price": 385.00,
                "compare_at_price": 420.00,
                "stock": 17,
                "low_stock_threshold": 4,
                "description": "Architectural cantilever desk luminaire. Incorporates high color rendering index (CRI 98) LED strip with continuous optical dimming dial and fluid mechanical counterbalance arm.",
                "material": "Extruded 6063 Aluminum & Steel Pivot",
                "dimensions": "820 mm Reach x 460 mm Height",
                "weight": "3.4 kg",
                "finish": "Matte Jet Black Powdercoat",
                "origin": "Copenhagen, Denmark",
                "image_url": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1000&q=80",
                "gallery_json": json.dumps([
                    "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1000&q=80"
                ]),
                "featured": True
            },
            {
                "sku": "AP-6028-RAW",
                "name": "Monolithic Concrete Table Light",
                "slug": "monolithic-concrete-table-light",
                "category_id": cat_lighting.id,
                "price": 190.00,
                "compare_at_price": None,
                "stock": 25,
                "low_stock_threshold": 5,
                "description": "Cast ultra-high-performance concrete cylinder holding an exposed frosted spiral filament bulb. Integrated rotary brass dimmer switch with tactile detents.",
                "material": "Cast UHPC Concrete & Turned Brass",
                "dimensions": "110 mm Diameter x 180 mm Height",
                "weight": "2.6 kg",
                "finish": "Sealed Raw Architectural Concrete",
                "origin": "Lyon, France",
                "image_url": "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1000&q=80",
                "gallery_json": json.dumps([
                    "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=1000&q=80"
                ]),
                "featured": False
            },
            # CAT-05 Ceramic & Material
            {
                "sku": "AP-3301-BNE",
                "name": "Brutalist Fluted Stoneware Vessel",
                "slug": "brutalist-fluted-stoneware-vessel",
                "category_id": cat_materials.id,
                "price": 160.00,
                "compare_at_price": None,
                "stock": 19,
                "low_stock_threshold": 4,
                "description": "Hand-thrown coarse stoneware vessel featuring vertical fluted exterior reliefs. High-temperature gas reduction fired to 1280°C with raw matte bone slip glaze.",
                "material": "Reduction-Fired Iron Stoneware",
                "dimensions": "180 mm Diameter x 260 mm Height",
                "weight": "2.2 kg",
                "finish": "Matte Raw Bone Slip Glaze",
                "origin": "Mashiko, Japan",
                "image_url": "https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=1000&q=80",
                "gallery_json": json.dumps([
                    "https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=1000&q=80"
                ]),
                "featured": False
            },
            {
                "sku": "AP-3310-BLK",
                "name": "Precision Machined Rollerball Pen & Base",
                "slug": "machined-rollerball-pen-base",
                "category_id": cat_materials.id,
                "price": 125.00,
                "compare_at_price": 140.00,
                "stock": 40,
                "low_stock_threshold": 8,
                "description": "Zero-tolerance capped rollerball writing instrument with matched magnetic docking cradle. Turned from solid brass stock and finished with physical vapor deposition (PVD) coating.",
                "material": "Solid Brass with PVD Ceramic Matrix",
                "dimensions": "138 mm Length x 11 mm Diameter",
                "weight": "54 g (Pen), 310 g (Base)",
                "finish": "Matte Charcoal PVD",
                "origin": "Graz, Austria",
                "image_url": "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=1000&q=80",
                "gallery_json": json.dumps([
                    "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&w=1000&q=80"
                ]),
                "featured": True
            }
        ]

        created_products = []
        for pdata in products_data:
            p = models.Product(**pdata)
            db.add(p)
            created_products.append(p)

        db.flush()

        # 4. PROMO CODES
        promos = [
            models.PromoCode(
                code="ATELIER10",
                discount_type="percentage",
                discount_value=10.0,
                min_order_value=100.0,
                is_active=True
            ),
            models.PromoCode(
                code="ENGINEERED50",
                discount_type="fixed",
                discount_value=50.0,
                min_order_value=250.0,
                is_active=True
            ),
            models.PromoCode(
                code="FREESHIP",
                discount_type="fixed",
                discount_value=15.0,
                min_order_value=50.0,
                is_active=True
            )
        ]
        db.add_all(promos)
        db.flush()

        # 5. INITIAL ORDERS (for testing and order management dashboard verification)
        # Order 1: Delivered
        order1 = models.Order(
            order_number="ORD-202611-A89102",
            user_id=client_user.id,
            customer_name="Elena Rostova",
            customer_email="elena.rostova@designworks.io",
            shipping_address="742 Evergreen Terrace, Suite 400",
            shipping_city="Seattle",
            shipping_postal_code="98101",
            shipping_country="United States",
            shipping_tier="Standard Courier",
            subtotal=680.00,
            shipping_cost=0.00,
            discount_amount=68.00,
            discount_code="ATELIER10",
            tax_amount=50.49,
            total_amount=662.49,
            payment_status="Paid",
            payment_method="Corporate Card",
            order_status="Delivered",
            notes="Signed delivery accepted at front desk.",
            created_at=datetime.utcnow() - timedelta(days=5)
        )
        db.add(order1)
        db.flush()

        item1 = models.OrderItem(
            order_id=order1.id,
            product_id=created_products[0].id,
            product_sku=created_products[0].sku,
            product_name=created_products[0].name,
            unit_price=created_products[0].price,
            quantity=1,
            line_total=680.00
        )
        db.add(item1)

        # Order 2: Processing
        order2 = models.Order(
            order_number="ORD-202611-B73901",
            user_id=client_user.id,
            customer_name="Elena Rostova",
            customer_email="elena.rostova@designworks.io",
            shipping_address="742 Evergreen Terrace, Suite 400",
            shipping_city="Seattle",
            shipping_postal_code="98101",
            shipping_country="United States",
            shipping_tier="Express Priority",
            subtotal=465.00,
            shipping_cost=35.00,
            discount_amount=0.00,
            discount_code=None,
            tax_amount=38.36,
            total_amount=538.36,
            payment_status="Paid",
            payment_method="Direct Settlement",
            order_status="Processing",
            notes="Awaiting final QA inspection before dispatch.",
            created_at=datetime.utcnow() - timedelta(hours=14)
        )
        db.add(order2)
        db.flush()

        item2_1 = models.OrderItem(
            order_id=order2.id,
            product_id=created_products[2].id,
            product_sku=created_products[2].sku,
            product_name=created_products[2].name,
            unit_price=created_products[2].price,
            quantity=1,
            line_total=340.00
        )
        item2_2 = models.OrderItem(
            order_id=order2.id,
            product_id=created_products[9].id,
            product_sku=created_products[9].sku,
            product_name=created_products[9].name,
            unit_price=created_products[9].price,
            quantity=1,
            line_total=125.00
        )
        db.add_all([item2_1, item2_2])

        db.commit()
        print("Database successfully seeded with 10 engineered products, 5 categories, 3 promo codes, 2 demo accounts, and sample orders.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
