import os
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, status, Query, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, Base, engine
from app import models, schemas, crud
from app.auth import (
    create_session,
    delete_session,
    get_current_user_optional,
    get_current_user,
    get_current_admin
)
from app.seed import seed_database

# Initialize database schema and auto-seed if needed
Base.metadata.create_all(bind=engine)
seed_database()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Full-stack precision e-commerce platform for architectural goods and hardware."
)

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
TEMPLATES_DIR = APP_DIR / "templates"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# ----------------------------------------------------
# FAVICON & BRANDING ROUTES
# ----------------------------------------------------
@app.get("/favicon.ico", include_in_schema=False)
async def favicon_ico():
    ico_path = STATIC_DIR / "favicon.ico"
    if ico_path.exists():
        return FileResponse(ico_path, media_type="image/x-icon")
    svg_path = STATIC_DIR / "favicon.svg"
    return FileResponse(svg_path, media_type="image/svg+xml")

@app.get("/favicon.svg", include_in_schema=False)
async def favicon_svg():
    return FileResponse(STATIC_DIR / "favicon.svg", media_type="image/svg+xml")

# ----------------------------------------------------
# PAGE ROUTES (EDITORIAL HTML & COMPLIANCE PAGES)
# ----------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def index_page(
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    categories = crud.get_categories(db)
    featured_products, _ = crud.get_products(db, sort_by="featured", limit=12)
    system_status = crud.verify_system_integrity()
    
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "categories": categories,
            "featured_products": featured_products,
            "current_user": current_user,
            "settings": settings,
            "system_status": system_status
        }
    )

@app.get("/privacy", response_class=HTMLResponse)
async def privacy_page(request: Request):
    return templates.TemplateResponse("privacy.html", {"request": request, "settings": settings})

@app.get("/terms", response_class=HTMLResponse)
async def terms_page(request: Request):
    return templates.TemplateResponse("terms.html", {"request": request, "settings": settings})

# ----------------------------------------------------
# AUTHENTICATION API ENDPOINTS
# ----------------------------------------------------
@app.post("/api/auth/register", response_model=schemas.UserResponse)
def register(user_in: schemas.UserCreate, response: Response, db: Session = Depends(get_db)):
    if crud.get_user_by_username(db, user_in.username):
        raise HTTPException(status_code=400, detail="Username is already registered")
    if crud.get_user_by_email(db, user_in.email):
        raise HTTPException(status_code=400, detail="Email is already registered")
        
    user = crud.create_user(db, user_in)
    session = create_session(db, user.id)
    response.set_cookie(
        key="session_token",
        value=session.token,
        httponly=True,
        max_age=settings.TOKEN_EXPIRE_HOURS * 3600,
        samesite="lax"
    )
    return user

@app.post("/api/auth/login")
def login(credentials: schemas.UserLogin, response: Response, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Verify username and password."
        )
    session = create_session(db, user.id)
    response.set_cookie(
        key="session_token",
        value=session.token,
        httponly=True,
        max_age=settings.TOKEN_EXPIRE_HOURS * 3600,
        samesite="lax"
    )
    return {
        "status": "success",
        "token": session.token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role
        }
    }

@app.post("/api/auth/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    token = request.cookies.get("session_token")
    if not token and "authorization" in request.headers:
        hdr = request.headers["authorization"]
        if hdr.startswith("Bearer "):
            token = hdr[7:].strip()
            
    if token:
        crud.delete_session(db, token)
        
    response.delete_cookie("session_token")
    return {"status": "success", "message": "Session invalidated"}

@app.get("/api/auth/me")
def get_me(current_user: Optional[models.User] = Depends(get_current_user_optional)):
    if not current_user:
        return {"authenticated": False, "user": None}
    return {
        "authenticated": True,
        "user": {
            "id": current_user.id,
            "username": current_user.username,
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role
        }
    }

# ----------------------------------------------------
# CATEGORY API ENDPOINTS
# ----------------------------------------------------
@app.get("/api/categories", response_model=List[schemas.CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    cats = crud.get_categories(db)
    result = []
    for c in cats:
        result.append(
            schemas.CategoryResponse(
                id=c.id,
                code=c.code,
                name=c.name,
                slug=c.slug,
                description=c.description,
                product_count=len([p for p in c.products if p.is_active])
            )
        )
    return result

@app.post("/api/categories", response_model=schemas.CategoryResponse)
def create_category(
    cat_in: schemas.CategoryCreate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if crud.get_category_by_slug(db, cat_in.slug):
        raise HTTPException(status_code=400, detail="Category slug already exists")
    cat = crud.create_category(db, cat_in)
    return schemas.CategoryResponse(
        id=cat.id,
        code=cat.code,
        name=cat.name,
        slug=cat.slug,
        description=cat.description,
        product_count=0
    )

# ----------------------------------------------------
# PRODUCT CATALOG & MANAGEMENT API ENDPOINTS
# ----------------------------------------------------
@app.get("/api/products")
def list_products(
    category: Optional[str] = Query(None, description="Category slug"),
    search: Optional[str] = Query(None, description="Search term across name, SKU, specs"),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    in_stock_only: Optional[bool] = Query(False),
    sort_by: Optional[str] = Query("featured", description="Sort option: featured, price_asc, price_desc, name_asc, newest"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    products, total = crud.get_products(
        db=db,
        category_slug=category,
        search=search,
        min_price=min_price,
        max_price=max_price,
        in_stock_only=in_stock_only,
        sort_by=sort_by,
        skip=skip,
        limit=limit
    )
    
    items = []
    for p in products:
        items.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "slug": p.slug,
            "category_id": p.category_id,
            "category_name": p.category.name if p.category else "",
            "category_code": p.category.code if p.category else "",
            "price": p.price,
            "compare_at_price": p.compare_at_price,
            "stock": p.stock,
            "low_stock_threshold": p.low_stock_threshold,
            "description": p.description,
            "material": p.material,
            "dimensions": p.dimensions,
            "weight": p.weight,
            "finish": p.finish,
            "origin": p.origin,
            "image_url": p.image_url,
            "gallery_urls": p.gallery_urls,
            "featured": p.featured,
            "is_active": p.is_active,
            "created_at": p.created_at.isoformat(),
            "updated_at": p.updated_at.isoformat()
        })
        
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": items
    }

@app.get("/api/products/{id_or_slug}")
def get_product(id_or_slug: str, db: Session = Depends(get_db)):
    if id_or_slug.isdigit():
        p = crud.get_product_by_id(db, int(id_or_slug))
    else:
        p = crud.get_product_by_slug(db, id_or_slug)
        
    if not p:
        raise HTTPException(status_code=404, detail="Product not found in catalog")
        
    return {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "slug": p.slug,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else "",
        "category_code": p.category.code if p.category else "",
        "price": p.price,
        "compare_at_price": p.compare_at_price,
        "stock": p.stock,
        "low_stock_threshold": p.low_stock_threshold,
        "description": p.description,
        "material": p.material,
        "dimensions": p.dimensions,
        "weight": p.weight,
        "finish": p.finish,
        "origin": p.origin,
        "image_url": p.image_url,
        "gallery_urls": p.gallery_urls,
        "featured": p.featured,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat()
    }

@app.post("/api/products", status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: schemas.ProductCreate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if crud.get_product_by_sku(db, product_in.sku):
        raise HTTPException(status_code=400, detail="SKU already exists in catalog")
    if crud.get_product_by_slug(db, product_in.slug):
        raise HTTPException(status_code=400, detail="Product slug already exists")
    if not crud.get_category_by_id(db, product_in.category_id):
        raise HTTPException(status_code=400, detail="Specified category does not exist")
        
    product = crud.create_product(db, product_in)
    return {"status": "success", "message": "Product created", "id": product.id, "sku": product.sku}

@app.put("/api/products/{product_id}")
def update_product(
    product_id: int,
    product_update: schemas.ProductUpdate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    product = crud.update_product(db, product_id, product_update)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"status": "success", "message": "Product updated", "id": product.id}

@app.post("/api/products/{product_id}/stock")
def adjust_stock(
    product_id: int,
    adj: schemas.StockAdjustment,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    try:
        product = crud.adjust_product_stock(db, product_id, adj.quantity_delta)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return {"status": "success", "new_stock": product.stock, "sku": product.sku}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/products/{product_id}")
def delete_product(
    product_id: int,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    deleted = crud.delete_product(db, product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"status": "success", "message": f"Product {product_id} deleted"}

# ----------------------------------------------------
# SHOPPING CART API ENDPOINTS
# ----------------------------------------------------
@app.get("/api/cart")
def get_cart(
    session_id: str = Query(..., description="Client session key"),
    promo: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    summary = crud.calculate_cart_summary(db, session_id, promo)
    return summary

@app.post("/api/cart/items")
def add_item_to_cart(
    item_in: schemas.CartItemAdd,
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    if not item_in.session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    try:
        cart_item = crud.add_to_cart(
            db=db,
            session_id=item_in.session_id,
            product_id=item_in.product_id,
            quantity=item_in.quantity,
            user_id=current_user.id if current_user else None
        )
        summary = crud.calculate_cart_summary(db, item_in.session_id)
        return {
            "status": "success",
            "message": "Item added to cart",
            "item_id": cart_item.id,
            "cart": summary
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/cart/items/{item_id}")
def update_cart_item(
    item_id: int,
    update_in: schemas.CartItemUpdate,
    session_id: str = Query(...),
    db: Session = Depends(get_db)
):
    res = crud.update_cart_item_quantity(db, item_id, update_in.quantity, session_id)
    summary = crud.calculate_cart_summary(db, session_id)
    return {
        "status": "success",
        "cart": summary
    }

@app.delete("/api/cart/items/{item_id}")
def remove_cart_item(
    item_id: int,
    session_id: str = Query(...),
    db: Session = Depends(get_db)
):
    success = crud.remove_cart_item(db, item_id, session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Cart item not found")
    summary = crud.calculate_cart_summary(db, session_id)
    return {
        "status": "success",
        "cart": summary
    }

@app.delete("/api/cart")
def clear_cart_endpoint(
    session_id: str = Query(...),
    db: Session = Depends(get_db)
):
    crud.clear_cart(db, session_id)
    return {"status": "success", "message": "Cart cleared"}

@app.post("/api/cart/apply-promo", response_model=schemas.PromoValidateResponse)
def apply_promo(
    req: schemas.PromoValidateRequest,
    db: Session = Depends(get_db)
):
    res = crud.validate_promo(db, req.code, req.subtotal)
    return res

# ----------------------------------------------------
# ORDER MANAGEMENT & CHECKOUT API ENDPOINTS
# ----------------------------------------------------
@app.post("/api/orders/checkout", response_model=schemas.OrderResponse)
def checkout(
    order_in: schemas.OrderCreate,
    current_user: Optional[models.User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    try:
        order = crud.create_order_from_cart(db, order_in, current_user)
        return order
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/orders/{id_or_number}", response_model=schemas.OrderResponse)
def get_order(
    id_or_number: str,
    db: Session = Depends(get_db)
):
    if id_or_number.isdigit():
        order = crud.get_order_by_id(db, int(id_or_number))
    else:
        order = crud.get_order_by_number(db, id_or_number)
        
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@app.get("/api/orders/my-orders", response_model=List[schemas.OrderResponse])
def get_my_orders(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_user_orders(db, user.id)

@app.get("/api/admin/orders")
def admin_list_orders(
    status: Optional[str] = Query(None, description="Status filter: Processing, Assembled, Dispatched, Delivered, Cancelled"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    orders, total = crud.get_all_orders(db, status_filter=status, skip=skip, limit=limit)
    items = []
    for o in orders:
        items.append({
            "id": o.id,
            "order_number": o.order_number,
            "customer_name": o.customer_name,
            "customer_email": o.customer_email,
            "shipping_city": o.shipping_city,
            "shipping_tier": o.shipping_tier,
            "total_amount": o.total_amount,
            "order_status": o.order_status,
            "payment_status": o.payment_status,
            "payment_method": o.payment_method,
            "item_count": sum(it.quantity for it in o.items),
            "created_at": o.created_at.isoformat(),
            "notes": o.notes
        })
    return {"total": total, "items": items}

@app.patch("/api/admin/orders/{order_id}/status")
def admin_update_order_status(
    order_id: int,
    status_update: schemas.OrderStatusUpdate,
    admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    order = crud.update_order_status(db, order_id, status_update.order_status, status_update.notes)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "status": "success",
        "message": f"Order {order.order_number} status updated to {order.order_status}",
        "order_number": order.order_number,
        "order_status": order.order_status
    }

# ----------------------------------------------------
# SYSTEM INTEGRITY & HARD LAUNCH STATUS API
# ----------------------------------------------------
@app.get("/api/system/integrity", response_model=schemas.SystemIntegrityResponse)
def check_system_integrity():
    return crud.verify_system_integrity()
