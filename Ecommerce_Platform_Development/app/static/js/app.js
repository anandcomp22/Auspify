/**
 * AUSPIFY ATELIER // COMMERCE ENGINE CLIENT SCRIPT
 * Full-stack state management, cart engine, catalog filters, order workflow, and admin CRUD.
 */

// Global State
const State = {
  sessionId: null,
  currentUser: null,
  activeCategory: 'all',
  searchQuery: '',
  sortBy: 'featured',
  inStockOnly: false,
  cart: {
    items: [],
    item_count: 0,
    subtotal: 0,
    discount_amount: 0,
    discount_code: null,
    shipping_estimated: 0,
    tax_estimated: 0,
    total_estimated: 0
  },
  currentProductDetail: null,
  activeDrawer: null
};

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  initSession();
  await checkAuth();
  await loadCart();
  await loadProducts();
  setupEventListeners();
  checkSystemIntegrity();
});

// ----------------------------------------------------
// SESSION & AUTHENTICATION
// ----------------------------------------------------
function initSession() {
  let sId = localStorage.getItem('atelier_session_id');
  if (!sId) {
    sId = 'ses_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
    localStorage.setItem('atelier_session_id', sId);
  }
  State.sessionId = sId;
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated) {
      State.currentUser = data.user;
    } else {
      State.currentUser = null;
    }
    renderAuthUI();
  } catch (err) {
    console.error('Auth verification failed:', err);
  }
}

function renderAuthUI() {
  const authNav = document.getElementById('nav-auth-section');
  if (!authNav) return;

  if (State.currentUser) {
    const isAdmin = State.currentUser.role === 'admin';
    authNav.innerHTML = `
      <div class="user-pill">
        <span class="user-name">${State.currentUser.full_name}</span>
        <span class="meta-tag" style="margin-left: 0.5rem; font-size: 0.65rem;">${State.currentUser.role.toUpperCase()}</span>
      </div>
      ${isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="openAdminDrawer()">Admin Control</button>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="openOrdersDrawer()">Orders</button>
      <button class="btn btn-secondary btn-sm" onclick="handleLogout()">Sign Out</button>
    `;
  } else {
    authNav.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="openAuthModal('login')">Sign In</button>
      <button class="btn btn-primary btn-sm" onclick="quickLoginDemo('shopper')">Demo Shopper</button>
      <button class="btn btn-secondary btn-sm" onclick="quickLoginDemo('admin')">Demo Admin</button>
    `;
  }
}

async function quickLoginDemo(type) {
  const username = type === 'admin' ? 'atelier_admin' : 'shopper_client';
  const password = 'Password123!';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      State.currentUser = data.user;
      renderAuthUI();
      showToast(`Authenticated as ${data.user.full_name} (${data.user.role})`);
      await loadCart();
    } else {
      showToast(data.detail || 'Authentication failed', 'error');
    }
  } catch (e) {
    showToast('Network error during authentication', 'error');
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    State.currentUser = null;
    renderAuthUI();
    showToast('Session terminated');
  } catch (e) {
    console.error(e);
  }
}

// ----------------------------------------------------
// PRODUCT CATALOG BROWSING & FILTERS
// ----------------------------------------------------
async function loadProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = `<div class="loading-state" style="grid-column: 1 / -1; padding: 3rem; text-align: center; font-family: var(--font-mono); color: var(--text-muted);">RETRIEVING SPECIFICATION REGISTRY...</div>`;

  const params = new URLSearchParams();
  if (State.activeCategory && State.activeCategory !== 'all') {
    params.append('category', State.activeCategory);
  }
  if (State.searchQuery) {
    params.append('search', State.searchQuery);
  }
  if (State.sortBy) {
    params.append('sort_by', State.sortBy);
  }
  if (State.inStockOnly) {
    params.append('in_stock_only', 'true');
  }

  try {
    const res = await fetch(`/api/products?${params.toString()}`);
    const data = await res.json();
    renderProductGrid(data.items);
  } catch (err) {
    grid.innerHTML = `<div class="error-state" style="grid-column: 1 / -1; padding: 2rem; color: var(--accent-crimson); font-family: var(--font-mono);">Failed to connect to product catalog repository.</div>`;
  }
}

function renderProductGrid(products) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 4rem 1rem; text-align: center;">
        <div style="font-family: var(--font-mono); color: var(--text-muted); margin-bottom: 0.5rem;">[NO MATCHING INVENTORY RECORDS]</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">Adjust search filters or select a different category classification.</div>
      </div>
    `;
    return;
  }

  const catColors = {
    'CAT-01': '#38BDF8', // Acoustics - Sky Cyan
    'CAT-02': '#FF4400', // Workstation - Signal Orange
    'CAT-03': '#F59E0B', // Horological - Precision Gold
    'CAT-04': '#10B981', // Luminaires - Luminary Emerald
    'CAT-05': '#EA580C'  // Materials - Terracotta Ochre
  };

  grid.innerHTML = products.map((p, idx) => {
    const indexNum = String(idx + 1).padStart(2, '0');
    const catColor = catColors[p.category_code] || 'var(--color-orange)';
    let stockClass = 'badge-stock';
    let stockLabel = `STOCK: ${p.stock} UNITS`;
    if (p.stock <= 0) {
      stockClass = 'badge-stock out-of-stock';
      stockLabel = 'OUT OF STOCK';
    } else if (p.stock <= p.low_stock_threshold) {
      stockClass = 'badge-stock low-stock';
      stockLabel = `LOW STOCK (${p.stock})`;
    }

    return `
      <article class="product-card" data-id="${p.id}" style="border-top: 3px solid ${catColor};">
        <div class="card-image-wrap">
          <img src="${p.image_url}" alt="${p.name}" class="card-image" loading="lazy">
          <div class="card-badges">
            <span class="badge-sku" style="background: ${catColor}; color: #0A0B0E; font-weight: 800; border-color: ${catColor};">#${indexNum}</span>
            <span class="badge-sku">${p.sku}</span>
            <span class="${stockClass}">${stockLabel}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="card-cat">
            <span style="display: inline-block; width: 7px; height: 7px; background: ${catColor}; box-shadow: 0 0 6px ${catColor};"></span>
            <span style="color: ${catColor}; font-weight: 700;">${p.category_code}</span>
            <span style="color: var(--text-muted);">//</span>
            <span style="color: var(--text-main);">${p.category_name}</span>
          </div>
          <h2 class="card-title">${p.name}</h2>
          <p class="card-desc">${p.description}</p>
          <div class="card-specs">
            <div class="spec-line"><span class="spec-k" style="color: var(--color-cyan);">MATERIAL</span><span class="spec-v">${p.material}</span></div>
            <div class="spec-line"><span class="spec-k" style="color: var(--color-gold);">DIMENSIONS</span><span class="spec-v">${p.dimensions}</span></div>
            <div class="spec-line"><span class="spec-k" style="color: var(--color-emerald);">ORIGIN</span><span class="spec-v">${p.origin}</span></div>
          </div>
          <div class="card-footer">
            <div class="card-price-block">
              <span class="card-price">$${p.price.toFixed(2)}</span>
              ${p.compare_at_price ? `<span class="card-compare">$${p.compare_at_price.toFixed(2)}</span>` : ''}
            </div>
            <div class="card-actions">
              <button class="btn btn-secondary btn-sm" onclick="openProductDetail('${p.id}')">Inspect</button>
              <button class="btn btn-primary btn-sm" onclick="handleAddToCart(${p.id}, 1)" ${p.stock <= 0 ? 'disabled' : ''}>
                ${p.stock > 0 ? '+ Add to Cart' : 'Sold Out'}
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function filterByCategory(slug) {
  // Sync catalog toolbar tabs
  document.querySelectorAll('.cat-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.category === slug);
  });

  // Sync spectrum bar chips (data-cat attribute)
  document.querySelectorAll('.spectrum-chip').forEach(chip => {
    const chipCat = chip.dataset.cat;
    if (chipCat === slug) {
      chip.classList.add('active-chip');
    } else {
      chip.classList.remove('active-chip');
    }
  });

  State.activeCategory = slug;
  loadProducts();
}

// ----------------------------------------------------
// PRODUCT SPECIFICATION DETAIL MODAL
// ----------------------------------------------------
async function openProductDetail(idOrSlug) {
  try {
    const res = await fetch(`/api/products/${idOrSlug}`);
    if (!res.ok) throw new Error('Product not found');
    const product = await res.json();
    State.currentProductDetail = product;

    const modal = document.getElementById('product-detail-modal');
    const modalBody = document.getElementById('product-detail-content');
    
    modalBody.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
        <div>
          <div style="aspect-ratio: 1; overflow: hidden; border: 1px solid var(--border-hairline); margin-bottom: 1rem;">
            <img id="detail-main-img" src="${product.image_url}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <div style="display: flex; gap: 0.5rem; overflow-x: auto;">
            <img src="${product.image_url}" style="width: 60px; height: 60px; object-fit: cover; border: 1px solid var(--accent-signal); cursor: pointer;" onclick="document.getElementById('detail-main-img').src='${product.image_url}'">
            ${(product.gallery_urls || []).map(url => `
              <img src="${url}" style="width: 60px; height: 60px; object-fit: cover; border: 1px solid var(--border-hairline); cursor: pointer;" onclick="document.getElementById('detail-main-img').src='${url}'">
            `).join('')}
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <div class="meta-tag" style="display: inline-block; margin-bottom: 0.5rem;">${product.category_code} // ${product.category_name}</div>
            <h2 style="font-size: 1.6rem; font-weight: 700; color: #FFFFFF; line-height: 1.2;">${product.name}</h2>
            <div style="font-family: var(--font-mono); color: var(--text-muted); font-size: 0.75rem; margin-top: 0.25rem;">SKU: ${product.sku}</div>
          </div>
          <div style="font-family: var(--font-mono); font-size: 1.5rem; font-weight: 700; color: #FFFFFF;">
            $${product.price.toFixed(2)}
            ${product.compare_at_price ? `<span style="font-size: 0.9rem; color: var(--text-muted); text-decoration: line-through; margin-left: 0.5rem;">$${product.compare_at_price.toFixed(2)}</span>` : ''}
          </div>
          <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6;">${product.description}</p>
          <div class="specs-table-container" style="margin: 0.5rem 0;">
            <table class="specs-table">
              <tbody>
                <tr><td style="color: var(--text-muted); width: 40%;">Material Grade</td><td>${product.material}</td></tr>
                <tr><td style="color: var(--text-muted);">Dimensions</td><td>${product.dimensions}</td></tr>
                <tr><td style="color: var(--text-muted);">Net Mass</td><td>${product.weight}</td></tr>
                <tr><td style="color: var(--text-muted);">Surface Finish</td><td>${product.finish}</td></tr>
                <tr><td style="color: var(--text-muted);">Origin Facility</td><td>${product.origin}</td></tr>
                <tr><td style="color: var(--text-muted);">Available Stock</td><td>${product.stock} units</td></tr>
              </tbody>
            </table>
          </div>
          <div style="margin-top: auto; display: flex; gap: 1rem; align-items: center;">
            <div class="cart-qty-ctrl" style="margin-top: 0;">
              <button class="qty-btn" onclick="adjustDetailQty(-1)">-</button>
              <span id="detail-qty-input" class="qty-num">1</span>
              <button class="qty-btn" onclick="adjustDetailQty(1)">+</button>
            </div>
            <button class="btn btn-primary" style="flex: 1;" onclick="addDetailToCart()" ${product.stock <= 0 ? 'disabled' : ''}>
              ${product.stock > 0 ? 'Add to Cart' : 'Inventory Depleted'}
            </button>
          </div>
        </div>
      </div>
    `;

    openModal('product-detail-modal');
  } catch (err) {
    showToast('Failed to load product specification', 'error');
  }
}

function adjustDetailQty(delta) {
  const span = document.getElementById('detail-qty-input');
  if (!span || !State.currentProductDetail) return;
  let current = parseInt(span.textContent, 10) || 1;
  let next = current + delta;
  if (next < 1) next = 1;
  if (next > State.currentProductDetail.stock) next = State.currentProductDetail.stock;
  span.textContent = next;
}

async function addDetailToCart() {
  if (!State.currentProductDetail) return;
  const qty = parseInt(document.getElementById('detail-qty-input').textContent, 10) || 1;
  await handleAddToCart(State.currentProductDetail.id, qty);
  closeModal('product-detail-modal');
}

// ----------------------------------------------------
// SHOPPING CART ENGINE
// ----------------------------------------------------
async function loadCart(promoCode = null) {
  try {
    const code = promoCode || State.cart.discount_code;
    const url = `/api/cart?session_id=${encodeURIComponent(State.sessionId)}${code ? '&promo=' + encodeURIComponent(code) : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    State.cart = data;
    renderCartUI();
  } catch (err) {
    console.error('Failed to load cart summary:', err);
  }
}

function renderCartUI() {
  // Update header badge
  const badge = document.getElementById('cart-badge-count');
  if (badge) {
    badge.textContent = State.cart.item_count;
    badge.style.display = State.cart.item_count > 0 ? 'inline-block' : 'none';
  }

  // Update Cart Drawer Items
  const itemsContainer = document.getElementById('cart-items-container');
  const footerContainer = document.getElementById('cart-footer-container');
  if (!itemsContainer || !footerContainer) return;

  if (State.cart.items.length === 0) {
    itemsContainer.innerHTML = `
      <div style="padding: 4rem 1rem; text-align: center;">
        <div style="font-family: var(--font-mono); color: var(--text-muted); margin-bottom: 0.5rem;">[EMPTY CART REGISTRY]</div>
        <div style="color: var(--text-secondary); font-size: 0.85rem;">Browse our catalog and select engineered goods to begin order allocation.</div>
      </div>
    `;
    footerContainer.style.display = 'none';
    return;
  }

  footerContainer.style.display = 'block';

  itemsContainer.innerHTML = State.cart.items.map(it => `
    <div class="cart-item">
      <img src="${it.image_url}" alt="${it.name}" class="cart-item-img">
      <div class="cart-item-info">
        <div class="cart-item-name">${it.name}</div>
        <div class="cart-item-sku">SKU: ${it.sku} &bull; $${it.price.toFixed(2)}</div>
        <div class="cart-qty-ctrl">
          <button class="qty-btn" onclick="updateCartItemQty(${it.id}, ${it.quantity - 1})">-</button>
          <span class="qty-num">${it.quantity}</span>
          <button class="qty-btn" onclick="updateCartItemQty(${it.id}, ${it.quantity + 1})">+</button>
        </div>
      </div>
      <div class="cart-item-total">
        <span class="cart-item-price">$${it.line_total.toFixed(2)}</span>
        <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.4rem; font-size: 0.65rem;" onclick="removeCartItem(${it.id})">Remove</button>
      </div>
    </div>
  `).join('');

  // Update Footer Summary
  const subtotalEl = document.getElementById('cart-subtotal');
  const discountRow = document.getElementById('cart-discount-row');
  const discountEl = document.getElementById('cart-discount');
  const shippingEl = document.getElementById('cart-shipping');
  const taxEl = document.getElementById('cart-tax');
  const totalEl = document.getElementById('cart-total');

  if (subtotalEl) subtotalEl.textContent = `$${State.cart.subtotal.toFixed(2)}`;
  if (discountRow) {
    if (State.cart.discount_amount > 0) {
      discountRow.style.display = 'flex';
      discountEl.textContent = `-$${State.cart.discount_amount.toFixed(2)} (${State.cart.discount_code})`;
    } else {
      discountRow.style.display = 'none';
    }
  }
  if (shippingEl) shippingEl.textContent = State.cart.shipping_estimated === 0 ? 'FREE' : `$${State.cart.shipping_estimated.toFixed(2)}`;
  if (taxEl) taxEl.textContent = `$${State.cart.tax_estimated.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `$${State.cart.total_estimated.toFixed(2)}`;
}

async function handleAddToCart(productId, quantity = 1) {
  try {
    const res = await fetch('/api/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: State.sessionId,
        product_id: productId,
        quantity: quantity
      })
    });
    const data = await res.json();
    if (res.ok) {
      State.cart = data.cart;
      renderCartUI();
      showToast('Item allocated to shopping cart');
      openDrawer('cart-drawer');
    } else {
      showToast(data.detail || 'Failed to add item to cart', 'error');
    }
  } catch (err) {
    showToast('Network error adding item', 'error');
  }
}

async function updateCartItemQty(itemId, newQty) {
  try {
    const res = await fetch(`/api/cart/items/${itemId}?session_id=${encodeURIComponent(State.sessionId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: newQty })
    });
    const data = await res.json();
    if (res.ok) {
      State.cart = data.cart;
      renderCartUI();
    }
  } catch (err) {
    console.error(err);
  }
}

async function removeCartItem(itemId) {
  try {
    const res = await fetch(`/api/cart/items/${itemId}?session_id=${encodeURIComponent(State.sessionId)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      State.cart = data.cart;
      renderCartUI();
      showToast('Item removed from cart');
    }
  } catch (err) {
    console.error(err);
  }
}

async function applyPromoCode() {
  const input = document.getElementById('promo-input');
  if (!input || !input.value.trim()) return;

  const code = input.value.trim().toUpperCase();
  try {
    const res = await fetch('/api/cart/apply-promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code,
        subtotal: State.cart.subtotal
      })
    });
    const data = await res.json();
    if (data.valid) {
      showToast(data.message);
      await loadCart(data.code);
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Error applying promotion code', 'error');
  }
}

// ----------------------------------------------------
// CHECKOUT WORKFLOW & ORDER EXECUTION
// ----------------------------------------------------
function openCheckoutModal() {
  if (State.cart.items.length === 0) {
    showToast('Cannot proceed with an empty cart', 'error');
    return;
  }

  closeDrawer('cart-drawer');
  
  // Prefill user data if available
  if (State.currentUser) {
    document.getElementById('checkout-name').value = State.currentUser.full_name;
    document.getElementById('checkout-email').value = State.currentUser.email;
  }

  // Update checkout order summary column
  const summaryBox = document.getElementById('checkout-order-summary');
  if (summaryBox) {
    summaryBox.innerHTML = `
      <div style="font-family: var(--font-mono); font-size: 0.8rem; border-bottom: 1px solid var(--border-hairline); padding-bottom: 0.5rem; margin-bottom: 0.75rem; color: #FFFFFF;">
        ORDER ALLOCATION (${State.cart.item_count} ITEMS)
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; margin-bottom: 1rem;">
        ${State.cart.items.map(it => `
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
            <span style="color: var(--text-secondary);">${it.name} &times; ${it.quantity}</span>
            <span style="font-family: var(--font-mono); color: #FFFFFF;">$${it.line_total.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      <div style="border-top: 1px solid var(--border-hairline); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; font-family: var(--font-mono); font-size: 0.78rem;">
        <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-muted);">SUBTOTAL</span><span>$${State.cart.subtotal.toFixed(2)}</span></div>
        ${State.cart.discount_amount > 0 ? `<div style="display: flex; justify-content: space-between; color: var(--accent-emerald);"><span>PROMO DISCOUNT</span><span>-$${State.cart.discount_amount.toFixed(2)}</span></div>` : ''}
        <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-muted);">FREIGHT</span><span>${State.cart.shipping_estimated === 0 ? 'INCLUDED' : '$' + State.cart.shipping_estimated.toFixed(2)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-muted);">ESTIMATED TAX</span><span>$${State.cart.tax_estimated.toFixed(2)}</span></div>
        <div style="display: flex; justify-content: space-between; font-size: 1rem; font-weight: 700; color: #FFFFFF; border-top: 1px solid var(--border-hairline); padding-top: 0.5rem; margin-top: 0.25rem;">
          <span>FINAL SETTLEMENT</span>
          <span>$${State.cart.total_estimated.toFixed(2)}</span>
        </div>
      </div>
    `;
  }

  openModal('checkout-modal');
}

async function executeCheckoutOrder(e) {
  if (e) e.preventDefault();

  const name = document.getElementById('checkout-name').value.trim();
  const email = document.getElementById('checkout-email').value.trim();
  const address = document.getElementById('checkout-address').value.trim();
  const city = document.getElementById('checkout-city').value.trim();
  const zip = document.getElementById('checkout-zip').value.trim();
  const country = document.getElementById('checkout-country').value.trim();
  const tier = document.getElementById('checkout-shipping-tier').value;
  const payment = document.getElementById('checkout-payment-method').value;
  const notes = document.getElementById('checkout-notes').value.trim();

  if (!name || !email || !address || !city || !zip) {
    showToast('Please fulfill all mandatory shipping fields', 'error');
    return;
  }

  const payload = {
    session_id: State.sessionId,
    customer_name: name,
    customer_email: email,
    shipping_address: address,
    shipping_city: city,
    shipping_postal_code: zip,
    shipping_country: country,
    shipping_tier: tier,
    payment_method: payment,
    promo_code: State.cart.discount_code,
    notes: notes
  };

  try {
    const res = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const order = await res.json();
    if (res.ok) {
      closeModal('checkout-modal');
      await loadCart();
      await loadProducts(); // Refresh stock counts in UI
      showOrderConfirmationModal(order);
    } else {
      showToast(order.detail || 'Order execution error', 'error');
    }
  } catch (err) {
    showToast('Network error placing order', 'error');
  }
}

function showOrderConfirmationModal(order) {
  const modal = document.getElementById('order-confirmed-modal');
  const body = document.getElementById('order-confirmed-content');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="text-align: center; padding: 1rem 0;">
      <div class="meta-tag" style="display: inline-block; margin-bottom: 0.5rem; color: var(--accent-emerald);">RECORD SECURED // ORDER CONCLUDED</div>
      <h2 style="font-size: 1.8rem; font-weight: 700; color: #FFFFFF; margin-bottom: 0.5rem;">Transmission Confirmed</h2>
      <p style="font-size: 0.9rem; color: var(--text-secondary); max-width: 440px; margin: 0 auto 1.5rem;">
        Your precision allocation has been committed to the manufacturing registry. An official dispatch manifest has been dispatched to <strong style="color: #FFFFFF;">${order.customer_email}</strong>.
      </p>
      
      <div class="specs-table-container" style="text-align: left; margin-bottom: 1.5rem;">
        <table class="specs-table">
          <tbody>
            <tr><td style="color: var(--text-muted); width: 40%;">Order Reference</td><td style="font-family: var(--font-mono); font-weight: 700; color: #FFFFFF;">${order.order_number}</td></tr>
            <tr><td style="color: var(--text-muted);">Consignee</td><td>${order.customer_name}</td></tr>
            <tr><td style="color: var(--text-muted);">Destination</td><td>${order.shipping_address}, ${order.shipping_city} ${order.shipping_postal_code}</td></tr>
            <tr><td style="color: var(--text-muted);">Routing Tier</td><td>${order.shipping_tier}</td></tr>
            <tr><td style="color: var(--text-muted);">Settlement Protocol</td><td>${order.payment_method} (${order.payment_status})</td></tr>
            <tr><td style="color: var(--text-muted);">Final Ledger Total</td><td style="font-family: var(--font-mono); font-weight: 700; color: #FFFFFF;">$${order.total_amount.toFixed(2)}</td></tr>
            <tr><td style="color: var(--text-muted);">Status</td><td><span class="status-badge status-processing">${order.order_status}</span></td></tr>
          </tbody>
        </table>
      </div>

      <button class="btn btn-primary" onclick="closeModal('order-confirmed-modal')">Acknowledge &amp; Return to Catalog</button>
    </div>
  `;

  openModal('order-confirmed-modal');
}

// ----------------------------------------------------
// CUSTOMER ORDER HISTORY
// ----------------------------------------------------
async function openOrdersDrawer() {
  if (!State.currentUser) {
    showToast('Sign in to inspect authenticated order history', 'error');
    openAuthModal('login');
    return;
  }

  const listContainer = document.getElementById('orders-history-list');
  if (!listContainer) return;

  listContainer.innerHTML = `<div style="font-family: var(--font-mono); color: var(--text-muted); padding: 2rem; text-align: center;">POLLING ORDER REPOSITORY...</div>`;
  openDrawer('orders-drawer');

  try {
    const res = await fetch('/api/orders/my-orders');
    if (!res.ok) throw new Error('Could not retrieve orders');
    const orders = await res.json();

    if (orders.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 3rem 1rem; text-align: center;">
          <div style="font-family: var(--font-mono); color: var(--text-muted); margin-bottom: 0.5rem;">[ZERO RECORDED PURCHASES]</div>
          <div style="color: var(--text-secondary); font-size: 0.85rem;">You have not executed any commercial orders under this account yet.</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = orders.map(o => `
      <div style="background: #0E1015; border: 1px solid var(--border-hairline); padding: 1.25rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-hairline); padding-bottom: 0.5rem;">
          <span style="font-family: var(--font-mono); font-weight: 700; color: #FFFFFF;">${o.order_number}</span>
          <span class="status-badge status-${o.order_status.toLowerCase()}">${o.order_status}</span>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-mono);">
          Placed: ${new Date(o.created_at).toLocaleDateString()} &bull; Rail: ${o.shipping_tier}
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.35rem;">
          ${o.items.map(it => `
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
              <span style="color: var(--text-main);">${it.product_name} &times; ${it.quantity}</span>
              <span style="font-family: var(--font-mono); color: var(--text-secondary);">$${it.line_total.toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
        <div style="border-top: 1px dashed var(--border-hairline); padding-top: 0.5rem; display: flex; justify-content: space-between; align-items: center; font-family: var(--font-mono);">
          <span style="font-size: 0.75rem; color: var(--text-muted);">TOTAL SETTLED</span>
          <span style="font-size: 0.95rem; font-weight: 700; color: #FFFFFF;">$${o.total_amount.toFixed(2)}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    listContainer.innerHTML = `<div style="color: var(--accent-crimson); font-family: var(--font-mono); padding: 1rem;">Failed to fetch account orders.</div>`;
  }
}

// ----------------------------------------------------
// ADMIN PRODUCT & ORDER MANAGEMENT PANEL
// ----------------------------------------------------
async function openAdminDrawer() {
  if (!State.currentUser || State.currentUser.role !== 'admin') {
    showToast('Unauthorized: Administrative role required', 'error');
    return;
  }
  openDrawer('admin-drawer');
  switchAdminTab('products');
}

function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
  const targetTab = document.getElementById(`admin-tab-${tab}`);
  if (targetTab) targetTab.classList.add('active');

  const contentProducts = document.getElementById('admin-content-products');
  const contentOrders = document.getElementById('admin-content-orders');
  const contentNewProduct = document.getElementById('admin-content-new-product');
  const contentCompliance = document.getElementById('admin-content-compliance');

  if (contentProducts) contentProducts.style.display = tab === 'products' ? 'block' : 'none';
  if (contentOrders) contentOrders.style.display = tab === 'orders' ? 'block' : 'none';
  if (contentNewProduct) contentNewProduct.style.display = tab === 'new-product' ? 'block' : 'none';
  if (contentCompliance) contentCompliance.style.display = tab === 'compliance' ? 'block' : 'none';

  if (tab === 'products') loadAdminProducts();
  if (tab === 'orders') loadAdminOrders();
  if (tab === 'compliance') checkSystemIntegrity();
}

async function loadAdminProducts() {
  const container = document.getElementById('admin-products-table-body');
  if (!container) return;

  try {
    const res = await fetch('/api/products?limit=100');
    const data = await res.json();

    container.innerHTML = data.items.map(p => `
      <tr>
        <td style="font-weight: 600;">${p.sku}</td>
        <td>${p.name}</td>
        <td>$${p.price.toFixed(2)}</td>
        <td>
          <input type="number" value="${p.stock}" min="0" style="width: 60px; background: #0E1015; border: 1px solid var(--border-hairline); color: #FFF; font-family: var(--font-mono); padding: 0.2rem 0.4rem;" onchange="adminUpdateStock(${p.id}, this.value, ${p.stock})">
        </td>
        <td>${p.is_active ? '<span style="color: var(--accent-emerald);">Active</span>' : '<span style="color: var(--text-muted);">Inactive</span>'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.68rem;" onclick="adminPromptPrice(${p.id}, ${p.price})">Price</button>
          <button class="btn btn-danger btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.68rem; margin-left: 0.25rem;" onclick="adminDeleteProduct(${p.id})">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="6" style="color: var(--accent-crimson);">Failed to load admin products</td></tr>`;
  }
}

async function adminUpdateStock(productId, newValue, oldValue) {
  const diff = parseInt(newValue, 10) - oldValue;
  if (diff === 0) return;

  try {
    const res = await fetch(`/api/products/${productId}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_delta: diff })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Stock updated for ${data.sku}: ${data.new_stock} units`);
      loadAdminProducts();
      loadProducts();
    } else {
      showToast(data.detail || 'Stock adjustment error', 'error');
    }
  } catch (err) {
    showToast('Failed to adjust stock', 'error');
  }
}

async function adminPromptPrice(productId, currentPrice) {
  const newPriceStr = prompt(`Enter updated unit price (Current: $${currentPrice.toFixed(2)}):`, currentPrice.toFixed(2));
  if (!newPriceStr) return;
  const newPrice = parseFloat(newPriceStr);
  if (isNaN(newPrice) || newPrice <= 0) {
    showToast('Invalid price entered', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: newPrice })
    });
    if (res.ok) {
      showToast('Price specification updated');
      loadAdminProducts();
      loadProducts();
    } else {
      showToast('Failed to update price', 'error');
    }
  } catch (err) {
    showToast('Network error updating price', 'error');
  }
}

async function adminDeleteProduct(productId) {
  if (!confirm(`Confirm deletion of product ID ${productId} from catalog?`)) return;

  try {
    const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Product removed from active catalog');
      loadAdminProducts();
      loadProducts();
    } else {
      showToast('Failed to delete product', 'error');
    }
  } catch (err) {
    showToast('Network error deleting product', 'error');
  }
}

async function handleAdminCreateProduct(e) {
  e.preventDefault();

  const sku = document.getElementById('new-p-sku').value.trim();
  const name = document.getElementById('new-p-name').value.trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const category_id = parseInt(document.getElementById('new-p-cat').value, 10);
  const price = parseFloat(document.getElementById('new-p-price').value);
  const stock = parseInt(document.getElementById('new-p-stock').value, 10);
  const material = document.getElementById('new-p-mat').value.trim();
  const dimensions = document.getElementById('new-p-dim').value.trim();
  const weight = document.getElementById('new-p-weight').value.trim();
  const finish = document.getElementById('new-p-finish').value.trim();
  const origin = document.getElementById('new-p-origin').value.trim();
  const image_url = document.getElementById('new-p-img').value.trim();
  const description = document.getElementById('new-p-desc').value.trim();

  const payload = {
    sku,
    name,
    slug,
    category_id,
    price,
    stock,
    material,
    dimensions,
    weight,
    finish,
    origin,
    image_url,
    description,
    featured: false,
    is_active: true
  };

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Product ${data.sku} added to catalog`);
      document.getElementById('new-product-form').reset();
      switchAdminTab('products');
      loadProducts();
    } else {
      showToast(data.detail || 'Failed to create product', 'error');
    }
  } catch (err) {
    showToast('Network error creating product', 'error');
  }
}

async function loadAdminOrders() {
  const container = document.getElementById('admin-orders-table-body');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/orders');
    const data = await res.json();

    container.innerHTML = data.items.map(o => `
      <tr>
        <td style="font-weight: 600;">${o.order_number}</td>
        <td>${o.customer_name}</td>
        <td>$${o.total_amount.toFixed(2)}</td>
        <td>
          <select style="background: #0E1015; border: 1px solid var(--border-hairline); color: #FFF; font-family: var(--font-mono); font-size: 0.72rem; padding: 0.2rem 0.4rem;" onchange="adminUpdateOrderStatus(${o.id}, this.value)">
            <option value="Processing" ${o.order_status === 'Processing' ? 'selected' : ''}>Processing</option>
            <option value="Assembled" ${o.order_status === 'Assembled' ? 'selected' : ''}>Assembled</option>
            <option value="Dispatched" ${o.order_status === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
            <option value="Delivered" ${o.order_status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Cancelled" ${o.order_status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
        <td>${new Date(o.created_at).toLocaleDateString()}</td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="5" style="color: var(--accent-crimson);">Failed to load admin orders</td></tr>`;
  }
}

async function adminUpdateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_status: newStatus })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message);
    } else {
      showToast('Failed to update status', 'error');
    }
  } catch (err) {
    showToast('Network error updating status', 'error');
  }
}

// ----------------------------------------------------
// SYSTEM INTEGRITY (Hard Launch Checklist Verification)
// ----------------------------------------------------
async function checkSystemIntegrity() {
  try {
    const res = await fetch('/api/system/integrity');
    const data = await res.json();

    const bannerDomain = document.getElementById('integrity-val-domain');
    const bannerFavicon = document.getElementById('integrity-val-favicon');
    const bannerNoAi = document.getElementById('integrity-val-no-ai');
    const bannerPrivacy = document.getElementById('integrity-val-privacy');
    const bannerTerms = document.getElementById('integrity-val-terms');
    const bannerLock = document.getElementById('integrity-val-lock');

    if (bannerDomain) bannerDomain.textContent = data.custom_domain;
    if (bannerFavicon) bannerFavicon.textContent = data.custom_favicon_active ? 'ACTIVE (SVG+ICO)' : 'MISSING';
    if (bannerNoAi) bannerNoAi.textContent = data.ai_badge_removed ? 'CLEARED (0 HITS)' : 'FOUND BADGES';
    if (bannerPrivacy) bannerPrivacy.textContent = data.privacy_policy_live ? 'LIVE (/privacy)' : 'OFFLINE';
    if (bannerTerms) bannerTerms.textContent = data.terms_conditions_live ? 'LIVE (/terms)' : 'OFFLINE';
    if (bannerLock) {
      bannerLock.textContent = data.all_criteria_met ? 'DEPLOYMENT LOCK RELEASED' : 'LOCKED';
      bannerLock.className = data.all_criteria_met ? 'status-badge status-delivered' : 'status-badge status-cancelled';
    }
  } catch (e) {
    console.error('Integrity audit error:', e);
  }
}

// ----------------------------------------------------
// UI EVENT LISTENERS & DRAWER/MODAL CONTROLS
// ----------------------------------------------------
function setupEventListeners() {
  // Category tabs
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      State.activeCategory = tab.dataset.category;
      loadProducts();
    });
  });

  // Search input with debounce
  const searchInput = document.getElementById('catalog-search');
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        State.searchQuery = e.target.value.trim();
        loadProducts();
      }, 250);
    });
  }

  // Sort select
  const sortSelect = document.getElementById('catalog-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      State.sortBy = e.target.value;
      loadProducts();
    });
  }

  // In stock toggle
  const inStockCheck = document.getElementById('filter-in-stock');
  if (inStockCheck) {
    inStockCheck.addEventListener('change', (e) => {
      State.inStockOnly = e.target.checked;
      loadProducts();
    });
  }

  // Close overlays on backdrop click
  const backdrop = document.getElementById('global-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeAllDrawers();
      closeAllModals();
    });
  }

  // Close modals on Esc key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllDrawers();
      closeAllModals();
    }
  });

  // Admin New Product Form Submit
  const newProductForm = document.getElementById('new-product-form');
  if (newProductForm) {
    newProductForm.addEventListener('submit', handleAdminCreateProduct);
  }
}

function openDrawer(drawerId) {
  closeAllDrawers();
  const drawer = document.getElementById(drawerId);
  const backdrop = document.getElementById('global-backdrop');
  if (drawer && backdrop) {
    drawer.classList.add('active');
    backdrop.classList.add('active');
    State.activeDrawer = drawerId;
  }
}

function closeDrawer(drawerId) {
  const drawer = document.getElementById(drawerId);
  const backdrop = document.getElementById('global-backdrop');
  if (drawer) drawer.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
  State.activeDrawer = null;
}

function closeAllDrawers() {
  document.querySelectorAll('.side-drawer').forEach(d => d.classList.remove('active'));
  const backdrop = document.getElementById('global-backdrop');
  if (backdrop) backdrop.classList.remove('active');
  State.activeDrawer = null;
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  const backdrop = document.getElementById('global-backdrop');
  if (modal && backdrop) {
    modal.classList.add('active');
    backdrop.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  const backdrop = document.getElementById('global-backdrop');
  if (modal) modal.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}

function closeAllModals() {
  document.querySelectorAll('.center-modal').forEach(m => m.classList.remove('active'));
}

// ----------------------------------------------------
// TOAST NOTIFICATIONS
// ----------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'error') {
    toast.style.borderColor = 'var(--accent-crimson)';
  } else if (type === 'success') {
    toast.style.borderColor = 'var(--accent-emerald)';
  }

  toast.innerHTML = `
    <span style="color: ${type === 'error' ? 'var(--accent-crimson)' : 'var(--accent-signal)'}; font-weight: 700;">&bull;</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}
