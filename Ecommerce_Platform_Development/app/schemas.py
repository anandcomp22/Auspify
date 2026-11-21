from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role: Optional[str] = "customer"

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: int
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

# Category Schemas
class CategoryBase(BaseModel):
    code: str
    name: str
    slug: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int
    product_count: Optional[int] = 0

    class Config:
        from_attributes = True

# Product Schemas
class ProductBase(BaseModel):
    sku: str
    name: str
    slug: str
    category_id: int
    price: float = Field(..., gt=0)
    compare_at_price: Optional[float] = None
    stock: int = Field(..., ge=0)
    low_stock_threshold: Optional[int] = 5
    description: str
    material: str
    dimensions: str
    weight: str
    finish: str
    origin: str
    image_url: str
    gallery_json: Optional[str] = "[]"
    featured: Optional[bool] = False
    is_active: Optional[bool] = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    price: Optional[float] = None
    compare_at_price: Optional[float] = None
    stock: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    description: Optional[str] = None
    material: Optional[str] = None
    dimensions: Optional[str] = None
    weight: Optional[str] = None
    finish: Optional[str] = None
    origin: Optional[str] = None
    image_url: Optional[str] = None
    gallery_json: Optional[str] = None
    featured: Optional[bool] = None
    is_active: Optional[bool] = None

class StockAdjustment(BaseModel):
    quantity_delta: int  # positive to add, negative to deduct

class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    category_name: Optional[str] = None
    category_code: Optional[str] = None

    class Config:
        from_attributes = True

# Cart Schemas
class CartItemAdd(BaseModel):
    product_id: int
    quantity: int = Field(1, ge=1)
    session_id: Optional[str] = None

class CartItemUpdate(BaseModel):
    quantity: int = Field(..., ge=0)  # 0 will trigger deletion

class CartItemDetail(BaseModel):
    id: int
    product_id: int
    sku: str
    name: str
    price: float
    image_url: str
    material: str
    quantity: int
    line_total: float
    stock_available: int

class CartSummary(BaseModel):
    session_id: str
    items: List[CartItemDetail]
    item_count: int
    subtotal: float
    shipping_estimated: float
    tax_estimated: float
    total_estimated: float

# Order Schemas
class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_sku: str
    product_name: str
    unit_price: float
    quantity: int
    line_total: float

    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    session_id: str
    customer_name: str
    customer_email: EmailStr
    shipping_address: str
    shipping_city: str
    shipping_postal_code: str
    shipping_country: str = "United States"
    shipping_tier: Optional[str] = "Standard Courier"
    payment_method: Optional[str] = "Corporate Card"
    promo_code: Optional[str] = None
    notes: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    order_status: str  # Processing, Assembled, Dispatched, Delivered, Cancelled
    notes: Optional[str] = None

class OrderResponse(BaseModel):
    id: int
    order_number: str
    customer_name: str
    customer_email: str
    shipping_address: str
    shipping_city: str
    shipping_postal_code: str
    shipping_country: str
    shipping_tier: str
    subtotal: float
    shipping_cost: float
    discount_amount: float
    discount_code: Optional[str]
    tax_amount: float
    total_amount: float
    payment_status: str
    payment_method: str
    order_status: str
    notes: Optional[str]
    created_at: datetime
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True

# Promo Code Schemas
class PromoValidateRequest(BaseModel):
    code: str
    subtotal: float

class PromoValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    discount_amount: float = 0.0
    message: str

# Hard Launch & System Integrity Check Schema
class SystemIntegrityResponse(BaseModel):
    custom_domain_connected: bool
    custom_domain: str
    custom_favicon_active: bool
    ai_badge_removed: bool
    privacy_policy_live: bool
    terms_conditions_live: bool
    deployment_locked: bool
    all_criteria_met: bool
