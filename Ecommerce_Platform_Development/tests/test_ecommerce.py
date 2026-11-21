import os
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure test uses an isolated in-memory or dedicated test database
os.environ["DATABASE_URL"] = "sqlite:///./test_ecommerce.db"
os.environ["CUSTOM_DOMAIN"] = "commerce.auspify.internal"

from app.main import app
from app.database import Base, engine, SessionLocal
from app import models, crud
from app.seed import seed_database

class TestEcommercePlatform(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        seed_database()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        engine.dispose()
        db_path = Path("test_ecommerce.db")
        if db_path.exists():
            try:
                db_path.unlink()
            except Exception:
                pass

    # ----------------------------------------------------
    # HARD LAUNCH & INTEGRITY VERIFICATION
    # ----------------------------------------------------
    def test_01_hard_launch_checklist(self):
        """Verify the 5 deployment criteria from the Hard Launch Checklist."""
        response = self.client.get("/api/system/integrity")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertTrue(data["custom_domain_connected"], "Custom Domain must be connected")
        self.assertEqual(data["custom_domain"], "commerce.auspify.internal")
        self.assertTrue(data["custom_favicon_active"], "Custom Favicon must be active")
        self.assertTrue(data["ai_badge_removed"], "AI footer badges must be stripped")
        self.assertTrue(data["privacy_policy_live"], "Privacy Policy must be live")
        self.assertTrue(data["terms_conditions_live"], "Terms & Conditions must be live")
        self.assertTrue(data["all_criteria_met"], "All Hard Launch criteria must be satisfied")
        self.assertFalse(data["deployment_locked"], "Deployment lock must be released")

    def test_02_legal_pages_rendered(self):
        """Ensure /privacy and /terms return 200 and formatted editorial content."""
        res_privacy = self.client.get("/privacy")
        self.assertEqual(res_privacy.status_code, 200)
        self.assertIn("Privacy Policy", res_privacy.text)
        self.assertNotIn("made with ai", res_privacy.text.lower())

        res_terms = self.client.get("/terms")
        self.assertEqual(res_terms.status_code, 200)
        self.assertIn("Terms &amp; Conditions", res_terms.text)
        self.assertNotIn("made with ai", res_terms.text.lower())

    def test_03_favicon_routes(self):
        """Verify favicon routes return valid image assets."""
        res_svg = self.client.get("/favicon.svg")
        self.assertEqual(res_svg.status_code, 200)
        self.assertIn("image/svg+xml", res_svg.headers.get("content-type", ""))

        res_ico = self.client.get("/favicon.ico")
        self.assertEqual(res_ico.status_code, 200)

    # ----------------------------------------------------
    # STEP 1: PRODUCT LISTING & BROWSING
    # ----------------------------------------------------
    def test_04_product_catalog_listing(self):
        """Test product listing, category filtering, search, and sorting."""
        res = self.client.get("/api/products")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["total"], 10)
        self.assertIn("items", data)

        # Filter by category
        res_cat = self.client.get("/api/products?category=acoustics")
        self.assertEqual(res_cat.status_code, 200)
        cat_data = res_cat.json()
        self.assertGreaterEqual(cat_data["total"], 1)
        for item in cat_data["items"]:
            self.assertEqual(item["category_code"], "CAT-01")

        # Search term
        res_search = self.client.get("/api/products?search=Titanium")
        self.assertEqual(res_search.status_code, 200)
        search_data = res_search.json()
        self.assertGreaterEqual(search_data["total"], 1)

        # Sort by price descending
        res_sort = self.client.get("/api/products?sort_by=price_desc")
        self.assertEqual(res_sort.status_code, 200)
        items = res_sort.json()["items"]
        prices = [it["price"] for it in items]
        self.assertEqual(prices, sorted(prices, reverse=True))

    def test_05_single_product_details(self):
        """Retrieve single product by ID and by slug."""
        res = self.client.get("/api/products/1")
        self.assertEqual(res.status_code, 200)
        p1 = res.json()
        self.assertIn("sku", p1)
        self.assertIn("material", p1)
        self.assertIn("dimensions", p1)

        res_slug = self.client.get(f"/api/products/{p1['slug']}")
        self.assertEqual(res_slug.status_code, 200)
        self.assertEqual(res_slug.json()["id"], p1["id"])

    # ----------------------------------------------------
    # STEP 2: PRODUCT MANAGEMENT CRUD APIS
    # ----------------------------------------------------
    def test_06_product_management_lifecycle(self):
        """Authenticate as admin, create product, update specs, adjust stock, and delete."""
        # 1. Login as admin
        login_res = self.client.post("/api/auth/login", json={
            "username": "atelier_admin",
            "password": "Password123!"
        })
        self.assertEqual(login_res.status_code, 200)
        token = login_res.json()["token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        # 2. Create new product
        new_prod_payload = {
            "sku": "AP-TEST-9999",
            "name": "Test Acoustic Diffuser Baffle",
            "slug": "test-acoustic-diffuser-baffle",
            "category_id": 1,
            "price": 295.00,
            "stock": 15,
            "description": "Precision milled mathematical quadratic residue acoustic sound diffuser.",
            "material": "Solid Walnut & Brass Dowels",
            "dimensions": "600 x 600 x 120 mm",
            "weight": "6.8 kg",
            "finish": "Natural Carnauba Wax",
            "origin": "Munich, Germany",
            "image_url": "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800",
            "featured": False,
            "is_active": True
        }
        create_res = self.client.post("/api/products", json=new_prod_payload, headers=auth_headers)
        self.assertEqual(create_res.status_code, 201)
        created_id = create_res.json()["id"]

        # 3. Update price and description
        update_res = self.client.put(
            f"/api/products/{created_id}",
            json={"price": 310.00, "description": "Updated diffuser spec"},
            headers=auth_headers
        )
        self.assertEqual(update_res.status_code, 200)

        # Verify update
        get_res = self.client.get(f"/api/products/{created_id}")
        self.assertEqual(get_res.json()["price"], 310.00)

        # 4. Adjust stock
        stock_res = self.client.post(
            f"/api/products/{created_id}/stock",
            json={"quantity_delta": 5},
            headers=auth_headers
        )
        self.assertEqual(stock_res.status_code, 200)
        self.assertEqual(stock_res.json()["new_stock"], 20)

        # 5. Delete product
        del_res = self.client.delete(f"/api/products/{created_id}", headers=auth_headers)
        self.assertEqual(del_res.status_code, 200)

        # Verify 404 on deleted product
        del_check = self.client.get(f"/api/products/{created_id}")
        self.assertEqual(del_check.status_code, 404)

    # ----------------------------------------------------
    # STEP 3: SHOPPING CART FUNCTIONALITY
    # ----------------------------------------------------
    def test_07_shopping_cart_workflow(self):
        """Test cart creation, adding items, quantity updates, promo code application, and summary math."""
        session_id = "test_cart_session_99"

        # 1. Add item to cart
        add_res = self.client.post("/api/cart/items", json={
            "session_id": session_id,
            "product_id": 1,
            "quantity": 2
        })
        self.assertEqual(add_res.status_code, 200)
        cart = add_res.json()["cart"]
        self.assertEqual(cart["item_count"], 2)
        item_id = cart["items"][0]["id"]

        # 2. Update quantity
        upd_res = self.client.put(
            f"/api/cart/items/{item_id}?session_id={session_id}",
            json={"quantity": 3}
        )
        self.assertEqual(upd_res.status_code, 200)
        self.assertEqual(upd_res.json()["cart"]["item_count"], 3)

        # 3. Apply promotional code (ATELIER10 -> 10% off)
        promo_res = self.client.post("/api/cart/apply-promo", json={
            "code": "ATELIER10",
            "subtotal": upd_res.json()["cart"]["subtotal"]
        })
        self.assertEqual(promo_res.status_code, 200)
        self.assertTrue(promo_res.json()["valid"])
        self.assertGreater(promo_res.json()["discount_amount"], 0)

        # 4. Check cart with promo query param
        summary_res = self.client.get(f"/api/cart?session_id={session_id}&promo=ATELIER10")
        self.assertEqual(summary_res.status_code, 200)
        s_data = summary_res.json()
        self.assertGreater(s_data["discount_amount"], 0)
        self.assertEqual(s_data["discount_code"], "ATELIER10")

        # 5. Remove item
        rem_res = self.client.delete(f"/api/cart/items/{item_id}?session_id={session_id}")
        self.assertEqual(rem_res.status_code, 200)
        self.assertEqual(rem_res.json()["cart"]["item_count"], 0)

    # ----------------------------------------------------
    # STEP 4: ORDER MANAGEMENT & USER ACCOUNTS
    # ----------------------------------------------------
    def test_08_user_registration_and_auth(self):
        """Register a new customer and verify authentication session."""
        reg_payload = {
            "username": "julian_krupp",
            "email": "julian@krupp-architects.de",
            "full_name": "Julian Krupp",
            "password": "SecurePassword99!"
        }
        reg_res = self.client.post("/api/auth/register", json=reg_payload)
        self.assertEqual(reg_res.status_code, 200)
        self.assertEqual(reg_res.json()["username"], "julian_krupp")

        # Login
        login_res = self.client.post("/api/auth/login", json={
            "username": "julian_krupp",
            "password": "SecurePassword99!"
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertIn("token", login_res.json())

    def test_09_end_to_end_checkout_and_inventory_decrement(self):
        """End-to-end checkout: adds item to cart, commits order, verifies inventory deduction and order status."""
        session_id = "test_e2e_session_42"

        # Check initial product stock
        prod_before = self.client.get("/api/products/3").json()
        initial_stock = prod_before["stock"]

        # Add 2 units of Product 3 to cart
        self.client.post("/api/cart/items", json={
            "session_id": session_id,
            "product_id": 3,
            "quantity": 2
        })

        # Execute checkout
        order_payload = {
            "session_id": session_id,
            "customer_name": "Julian Krupp",
            "customer_email": "julian@krupp-architects.de",
            "shipping_address": "Königsallee 14",
            "shipping_city": "Düsseldorf",
            "shipping_postal_code": "40212",
            "shipping_country": "Germany",
            "shipping_tier": "Standard Courier",
            "payment_method": "Corporate Card",
            "promo_code": "ENGINEERED50",
            "notes": "Fragile optical cargo."
        }
        order_res = self.client.post("/api/orders/checkout", json=order_payload)
        self.assertEqual(order_res.status_code, 200)
        order_data = order_res.json()
        self.assertTrue(order_data["order_number"].startswith("ORD-"))
        self.assertEqual(order_data["order_status"], "Processing")
        self.assertEqual(len(order_data["items"]), 1)
        self.assertEqual(order_data["items"][0]["quantity"], 2)

        # Verify inventory was decremented by exactly 2
        prod_after = self.client.get("/api/products/3").json()
        self.assertEqual(prod_after["stock"], initial_stock - 2)

        # Verify cart was cleared after checkout
        cart_after = self.client.get(f"/api/cart?session_id={session_id}").json()
        self.assertEqual(cart_after["item_count"], 0)

        # Admin order status update
        login_res = self.client.post("/api/auth/login", json={
            "username": "atelier_admin",
            "password": "Password123!"
        })
        token = login_res.json()["token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        status_res = self.client.patch(
            f"/api/admin/orders/{order_data['id']}/status",
            json={"order_status": "Dispatched", "notes": "Tracking ID #DHL-981244"},
            headers=auth_headers
        )
        self.assertEqual(status_res.status_code, 200)
        self.assertEqual(status_res.json()["order_status"], "Dispatched")

if __name__ == "__main__":
    unittest.main()
