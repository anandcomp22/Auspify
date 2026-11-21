import uuid
import datetime
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc
from app import models, schemas
from app.auth import hash_password, verify_password
from app.config import settings

# ----------------------------------------------------
# USER MANAGEMENT
# ----------------------------------------------------

def get_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    hashed_pwd = hash_password(user_in.password)
    user = models.User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        password_hash=hashed_pwd,
        role=user_in.role or "customer"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def authenticate_user(db: Session, credentials: schemas.UserLogin) -> Optional[models.User]:
    user = get_user_by_username(db, credentials.username)
    if not user:
        # Check by email as alternative login identifier
        user = get_user_by_email(db, credentials.username)
    if not user:
        return None
    if not verify_password(credentials.password, user.password_hash):
        return None
    return user

# ----------------------------------------------------
# CATEGORY MANAGEMENT
# ----------------------------------------------------

def get_categories(db: Session) -> List[models.Category]:
    return db.query(models.Category).order_by(models.Category.code).all()

def get_category_by_id(db: Session, category_id: int) -> Optional[models.Category]:
    return db.query(models.Category).filter(models.Category.id == category_id).first()

def get_category_by_slug(db: Session, slug: str) -> Optional[models.Category]:
    return db.query(models.Category).filter(models.Category.slug == slug).first()

def create_category(db: Session, cat_in: schemas.CategoryCreate) -> models.Category:
    category = models.Category(
        code=cat_in.code,
        name=cat_in.name,
        slug=cat_in.slug,
        description=cat_in.description
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category

# ----------------------------------------------------
# PRODUCT CATALOG & INVENTORY MANAGEMENT
# ----------------------------------------------------

def get_products(
    db: Session,
    category_slug: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    in_stock_only: Optional[bool] = False,
    sort_by: Optional[str] = "featured",
    skip: int = 0,
    limit: int = 50,
    include_inactive: bool = False
) -> Tuple[List[models.Product], int]:
    query = db.query(models.Product)
    
    if not include_inactive:
        query = query.filter(models.Product.is_active.is_(True))
        
    if category_slug and category_slug != "all":
        category = get_category_by_slug(db, category_slug)
        if category:
            query = query.filter(models.Product.category_id == category.id)
            
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.Product.name.ilike(term),
                models.Product.sku.ilike(term),
                models.Product.description.ilike(term),
                models.Product.material.ilike(term)
            )
        )
        
    if min_price is not None:
        query = query.filter(models.Product.price >= min_price)
    if max_price is not None:
        query = query.filter(models.Product.price <= max_price)
        
    if in_stock_only:
        query = query.filter(models.Product.stock > 0)
        
    total_count = query.count()
    
    # Sorting mechanics
    if sort_by == "price_asc":
        query = query.order_by(asc(models.Product.price))
    elif sort_by == "price_desc":
        query = query.order_by(desc(models.Product.price))
    elif sort_by == "name_asc":
        query = query.order_by(asc(models.Product.name))
    elif sort_by == "newest":
        query = query.order_by(desc(models.Product.created_at))
    elif sort_by == "featured":
        query = query.order_by(desc(models.Product.featured), desc(models.Product.id))
    else:
        query = query.order_by(desc(models.Product.id))
        
    products = query.offset(skip).limit(limit).all()
    return products, total_count

def get_product_by_id(db: Session, product_id: int) -> Optional[models.Product]:
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def get_product_by_slug(db: Session, slug: str) -> Optional[models.Product]:
    return db.query(models.Product).filter(models.Product.slug == slug).first()

def get_product_by_sku(db: Session, sku: str) -> Optional[models.Product]:
    return db.query(models.Product).filter(models.Product.sku == sku).first()

def create_product(db: Session, product_in: schemas.ProductCreate) -> models.Product:
    product = models.Product(
        sku=product_in.sku,
        name=product_in.name,
        slug=product_in.slug,
        category_id=product_in.category_id,
        price=product_in.price,
        compare_at_price=product_in.compare_at_price,
        stock=product_in.stock,
        low_stock_threshold=product_in.low_stock_threshold or 5,
        description=product_in.description,
        material=product_in.material,
        dimensions=product_in.dimensions,
        weight=product_in.weight,
        finish=product_in.finish,
        origin=product_in.origin,
        image_url=product_in.image_url,
        gallery_json=product_in.gallery_json or "[]",
        featured=product_in.featured or False,
        is_active=product_in.is_active if product_in.is_active is not None else True
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

def update_product(db: Session, product_id: int, product_update: schemas.ProductUpdate) -> Optional[models.Product]:
    product = get_product_by_id(db, product_id)
    if not product:
        return None
        
    update_data = product_update.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(product, field, val)
        
    db.commit()
    db.refresh(product)
    return product

def adjust_product_stock(db: Session, product_id: int, delta: int) -> Optional[models.Product]:
    product = get_product_by_id(db, product_id)
    if not product:
        return None
    new_stock = product.stock + delta
    if new_stock < 0:
        raise ValueError(f"Insufficient inventory for SKU {product.sku}. Available: {product.stock}, Requested delta: {delta}")
    product.stock = new_stock
    db.commit()
    db.refresh(product)
    return product

def delete_product(db: Session, product_id: int) -> bool:
    product = get_product_by_id(db, product_id)
    if not product:
        return False
    db.delete(product)
    db.commit()
    return True

# ----------------------------------------------------
# SHOPPING CART ENGINE
# ----------------------------------------------------

def get_cart_items(db: Session, session_id: str, user_id: Optional[int] = None) -> List[models.CartItem]:
    query = db.query(models.CartItem).filter(models.CartItem.session_id == session_id)
    if user_id:
        query = db.query(models.CartItem).filter(
            or_(models.CartItem.session_id == session_id, models.CartItem.user_id == user_id)
        )
    return query.all()

def add_to_cart(db: Session, session_id: str, product_id: int, quantity: int = 1, user_id: Optional[int] = None) -> models.CartItem:
    product = get_product_by_id(db, product_id)
    if not product or not product.is_active:
        raise ValueError("Product not available or active")
    if product.stock <= 0:
        raise ValueError("Product is currently out of stock")
        
    cart_item = db.query(models.CartItem).filter(
        models.CartItem.session_id == session_id,
        models.CartItem.product_id == product_id
    ).first()
    
    if cart_item:
        new_quantity = cart_item.quantity + quantity
        if new_quantity > product.stock:
            new_quantity = product.stock
        cart_item.quantity = new_quantity
        if user_id and not cart_item.user_id:
            cart_item.user_id = user_id
    else:
        actual_qty = min(quantity, product.stock)
        cart_item = models.CartItem(
            session_id=session_id,
            user_id=user_id,
            product_id=product_id,
            quantity=actual_qty
        )
        db.add(cart_item)
        
    db.commit()
    db.refresh(cart_item)
    return cart_item

def update_cart_item_quantity(db: Session, item_id: int, quantity: int, session_id: str) -> Optional[models.CartItem]:
    cart_item = db.query(models.CartItem).filter(
        models.CartItem.id == item_id,
        models.CartItem.session_id == session_id
    ).first()
    
    if not cart_item:
        return None
        
    if quantity <= 0:
        db.delete(cart_item)
        db.commit()
        return None
        
    # Validate against actual stock
    product = get_product_by_id(db, cart_item.product_id)
    if product and quantity > product.stock:
        quantity = product.stock
        
    cart_item.quantity = quantity
    db.commit()
    db.refresh(cart_item)
    return cart_item

def remove_cart_item(db: Session, item_id: int, session_id: str) -> bool:
    cart_item = db.query(models.CartItem).filter(
        models.CartItem.id == item_id,
        models.CartItem.session_id == session_id
    ).first()
    if not cart_item:
        return False
    db.delete(cart_item)
    db.commit()
    return True

def clear_cart(db: Session, session_id: str):
    db.query(models.CartItem).filter(models.CartItem.session_id == session_id).delete()
    db.commit()

def calculate_cart_summary(db: Session, session_id: str, promo_code_str: Optional[str] = None) -> dict:
    items = db.query(models.CartItem).filter(models.CartItem.session_id == session_id).all()
    
    cart_details = []
    subtotal = 0.0
    item_count = 0
    
    for item in items:
        p = item.product
        if not p:
            continue
        line_total = round(p.price * item.quantity, 2)
        subtotal += line_total
        item_count += item.quantity
        cart_details.append({
            "id": item.id,
            "product_id": p.id,
            "sku": p.sku,
            "name": p.name,
            "price": p.price,
            "image_url": p.image_url,
            "material": p.material,
            "quantity": item.quantity,
            "line_total": line_total,
            "stock_available": p.stock
        })
        
    subtotal = round(subtotal, 2)
    
    # Calculate discount if promo provided
    discount_amount = 0.0
    promo_applied = None
    if promo_code_str and subtotal > 0:
        val_res = validate_promo(db, promo_code_str, subtotal)
        if val_res["valid"]:
            discount_amount = val_res["discount_amount"]
            promo_applied = val_res["code"]
            
    net_after_discount = max(0.0, subtotal - discount_amount)
    
    # Shipping rules: Free above threshold or flat standard rate
    shipping_estimated = 0.0
    if subtotal > 0:
        if subtotal >= settings.FREE_SHIPPING_THRESHOLD:
            shipping_estimated = 0.0
        else:
            shipping_estimated = settings.STANDARD_SHIPPING_FLAT
            
    tax_estimated = round(net_after_discount * settings.TAX_RATE, 2)
    total_estimated = round(net_after_discount + shipping_estimated + tax_estimated, 2)
    
    return {
        "session_id": session_id,
        "items": cart_details,
        "item_count": item_count,
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "discount_code": promo_applied,
        "shipping_estimated": shipping_estimated,
        "tax_estimated": tax_estimated,
        "total_estimated": total_estimated
    }

# ----------------------------------------------------
# PROMOTIONS & VALIDATION
# ----------------------------------------------------

def validate_promo(db: Session, code: str, subtotal: float) -> dict:
    code_clean = code.strip().upper()
    promo = db.query(models.PromoCode).filter(
        models.PromoCode.code == code_clean,
        models.PromoCode.is_active.is_(True)
    ).first()
    
    if not promo:
        return {
            "valid": False,
            "code": code_clean,
            "discount_amount": 0.0,
            "message": "Invalid or expired promotional voucher code"
        }
        
    if subtotal < promo.min_order_value:
        return {
            "valid": False,
            "code": code_clean,
            "discount_amount": 0.0,
            "message": f"Requires minimum subtotal of ${promo.min_order_value:.2f}"
        }
        
    if promo.discount_type == "percentage":
        discount = round(subtotal * (promo.discount_value / 100.0), 2)
    else:
        discount = round(min(promo.discount_value, subtotal), 2)
        
    return {
        "valid": True,
        "code": promo.code,
        "discount_type": promo.discount_type,
        "discount_value": promo.discount_value,
        "discount_amount": discount,
        "message": f"Promo code {promo.code} applied successfully"
    }

# ----------------------------------------------------
# ORDER MANAGEMENT & TRANSACTIONS
# ----------------------------------------------------

def create_order_from_cart(
    db: Session,
    order_in: schemas.OrderCreate,
    user: Optional[models.User] = None
) -> models.Order:
    cart_summary = calculate_cart_summary(db, order_in.session_id, order_in.promo_code)
    items = cart_summary["items"]
    
    if not items:
        raise ValueError("Shopping cart is empty. Cannot generate order.")
        
    # Verify inventory sufficiency for all items atomically
    for it in items:
        product = get_product_by_id(db, it["product_id"])
        if not product or not product.is_active:
            raise ValueError(f"Product {it['sku']} is no longer available.")
        if product.stock < it["quantity"]:
            raise ValueError(f"Insufficient inventory for {product.name} ({product.sku}). Available: {product.stock}, In Cart: {it['quantity']}")
            
    # Compute shipping cost based on requested tier
    subtotal = cart_summary["subtotal"]
    discount = cart_summary["discount_amount"]
    
    if order_in.shipping_tier == "Express Priority":
        shipping_cost = settings.EXPRESS_SHIPPING_FLAT
    elif subtotal >= settings.FREE_SHIPPING_THRESHOLD:
        shipping_cost = 0.0
    else:
        shipping_cost = settings.STANDARD_SHIPPING_FLAT
        
    net_taxable = max(0.0, subtotal - discount)
    tax_cost = round(net_taxable * settings.TAX_RATE, 2)
    total_cost = round(net_taxable + shipping_cost + tax_cost, 2)
    
    # Generate engineered order reference number
    unique_suffix = uuid.uuid4().hex[:6].upper()
    order_number = f"ORD-{datetime.datetime.utcnow().strftime('%Y%m')}-{unique_suffix}"
    
    order = models.Order(
        order_number=order_number,
        user_id=user.id if user else None,
        customer_name=order_in.customer_name,
        customer_email=order_in.customer_email,
        shipping_address=order_in.shipping_address,
        shipping_city=order_in.shipping_city,
        shipping_postal_code=order_in.shipping_postal_code,
        shipping_country=order_in.shipping_country,
        shipping_tier=order_in.shipping_tier or "Standard Courier",
        subtotal=subtotal,
        shipping_cost=shipping_cost,
        discount_amount=discount,
        discount_code=order_in.promo_code if discount > 0 else None,
        tax_amount=tax_cost,
        total_amount=total_cost,
        payment_status="Paid",
        payment_method=order_in.payment_method or "Corporate Card",
        order_status="Processing",
        notes=order_in.notes
    )
    db.add(order)
    db.flush()
    
    # Create order items and adjust inventory atomically
    for it in items:
        order_item = models.OrderItem(
            order_id=order.id,
            product_id=it["product_id"],
            product_sku=it["sku"],
            product_name=it["name"],
            unit_price=it["price"],
            quantity=it["quantity"],
            line_total=it["line_total"]
        )
        db.add(order_item)
        
        # Deduct from product stock
        prod = get_product_by_id(db, it["product_id"])
        prod.stock -= it["quantity"]
        
    # Clear cart
    clear_cart(db, order_in.session_id)
    
    db.commit()
    db.refresh(order)
    return order

def get_order_by_id(db: Session, order_id: int) -> Optional[models.Order]:
    return db.query(models.Order).filter(models.Order.id == order_id).first()

def get_order_by_number(db: Session, order_number: str) -> Optional[models.Order]:
    return db.query(models.Order).filter(models.Order.order_number == order_number).first()

def get_user_orders(db: Session, user_id: int) -> List[models.Order]:
    return db.query(models.Order).filter(models.Order.user_id == user_id).order_by(desc(models.Order.created_at)).all()

def get_all_orders(
    db: Session,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> Tuple[List[models.Order], int]:
    query = db.query(models.Order)
    if status_filter and status_filter != "all":
        query = query.filter(models.Order.order_status == status_filter)
    total = query.count()
    orders = query.order_by(desc(models.Order.created_at)).offset(skip).limit(limit).all()
    return orders, total

def update_order_status(db: Session, order_id: int, new_status: str, notes: Optional[str] = None) -> Optional[models.Order]:
    order = get_order_by_id(db, order_id)
    if not order:
        return None
    order.order_status = new_status
    if notes:
        order.notes = notes
    db.commit()
    db.refresh(order)
    return order

# ----------------------------------------------------
# SYSTEM INTEGRITY & COMPLIANCE VERIFICATION
# ----------------------------------------------------

def verify_system_integrity() -> dict:
    from pathlib import Path
    app_dir = Path(__file__).resolve().parent
    templates_dir = app_dir / "templates"
    static_dir = app_dir / "static"
    
    # 1. Custom Domain connected
    custom_domain = settings.CUSTOM_DOMAIN
    custom_domain_connected = bool(custom_domain and len(custom_domain) > 3)
    
    # 2. Custom Favicon uploaded and active
    favicon_svg = (static_dir / "favicon.svg").exists()
    favicon_ico = (static_dir / "favicon.ico").exists()
    custom_favicon_active = favicon_svg or favicon_ico
    
    # 3. Made with AI footer badge completely removed
    ai_badge_removed = True
    for html_file in templates_dir.glob("*.html"):
        content = html_file.read_text(encoding="utf-8").lower()
        if "made with ai" in content or "built with ai" in content or "powered by ai" in content:
            ai_badge_removed = False
            break
            
    # 4. Privacy policy live
    privacy_policy_live = (templates_dir / "privacy.html").exists()
    
    # 5. Terms & Conditions live
    terms_conditions_live = (templates_dir / "terms.html").exists()
    
    all_met = all([
        custom_domain_connected,
        custom_favicon_active,
        ai_badge_removed,
        privacy_policy_live,
        terms_conditions_live
    ])
    
    return {
        "custom_domain_connected": custom_domain_connected,
        "custom_domain": custom_domain,
        "custom_favicon_active": custom_favicon_active,
        "ai_badge_removed": ai_badge_removed,
        "privacy_policy_live": privacy_policy_live,
        "terms_conditions_live": terms_conditions_live,
        "deployment_locked": not all_met,
        "all_criteria_met": all_met
    }
