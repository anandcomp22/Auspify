import datetime
import json
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(128), unique=True, index=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    full_name = Column(String(128), nullable=False)
    role = Column(String(32), default="customer")  # "customer", "admin"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    cart_items = relationship("CartItem", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("SessionToken", back_populates="user", cascade="all, delete-orphan")

class SessionToken(Base):
    __tablename__ = "session_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(128), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User", back_populates="sessions")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(16), unique=True, index=True, nullable=False)  # e.g., "CAT-01"
    name = Column(String(64), nullable=False)
    slug = Column(String(64), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    products = relationship("Product", back_populates="category", cascade="all, delete-orphan")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    slug = Column(String(128), unique=True, index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    price = Column(Float, nullable=False)
    compare_at_price = Column(Float, nullable=True)
    stock = Column(Integer, default=0, nullable=False)
    low_stock_threshold = Column(Integer, default=5)
    description = Column(Text, nullable=False)
    
    # Precision technical specs
    material = Column(String(128), nullable=False, default="Aerospace Grade Alloy")
    dimensions = Column(String(128), nullable=False, default="Standard")
    weight = Column(String(64), nullable=False, default="Standard")
    finish = Column(String(128), nullable=False, default="Matte Anodized")
    origin = Column(String(64), nullable=False, default="Baden-Württemberg")
    
    image_url = Column(String(512), nullable=False)
    gallery_json = Column(Text, default="[]")
    featured = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    category = relationship("Category", back_populates="products")
    cart_items = relationship("CartItem", back_populates="product", cascade="all, delete-orphan")
    order_items = relationship("OrderItem", back_populates="product")

    @property
    def gallery_urls(self):
        try:
            return json.loads(self.gallery_json) if self.gallery_json else []
        except Exception:
            return []

class CartItem(Base):
    __tablename__ = "cart_items"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(128), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    added_at = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="cart_items")
    user = relationship("User", back_populates="cart_items")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(32), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    customer_name = Column(String(128), nullable=False)
    customer_email = Column(String(128), nullable=False)
    shipping_address = Column(String(256), nullable=False)
    shipping_city = Column(String(64), nullable=False)
    shipping_postal_code = Column(String(32), nullable=False)
    shipping_country = Column(String(64), nullable=False)
    shipping_tier = Column(String(64), default="Standard Courier")
    
    subtotal = Column(Float, nullable=False)
    shipping_cost = Column(Float, nullable=False)
    discount_amount = Column(Float, default=0.0)
    discount_code = Column(String(32), nullable=True)
    tax_amount = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    
    payment_status = Column(String(32), default="Paid")  # Paid, Authorized, Refunded
    payment_method = Column(String(64), default="Direct Settlement")
    order_status = Column(String(32), default="Processing")  # Processing, Assembled, Dispatched, Delivered, Cancelled
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    product_sku = Column(String(32), nullable=False)
    product_name = Column(String(128), nullable=False)
    unit_price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    line_total = Column(Float, nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")

class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), unique=True, index=True, nullable=False)
    discount_type = Column(String(16), default="percentage")  # "percentage", "fixed"
    discount_value = Column(Float, nullable=False)
    min_order_value = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
