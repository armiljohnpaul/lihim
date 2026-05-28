let cart = [];
let allProducts = [];
let filteredProducts = [];
let currentSort = 'popular';
let showOnlyActive = true;
let currentCustomer = null;


document.addEventListener('DOMContentLoaded', async () => {
    if (typeof auth !== 'undefined') {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                currentCustomer = user;
                await saveCustomerToFirestore(user);
                updateAuthUI(user);
            } else {
                currentCustomer = null;
                updateAuthUI(null);
            }
        });
    }
    await loadProducts();
    loadCart();
});


async function signInWithGoogle() {
    const errorDiv = document.getElementById('auth-error');
    errorDiv.style.display = 'none';
    const btn = document.getElementById('google-signin-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        if (!user.email) throw new Error('Could not retrieve email from Google account.');
        closeAuthModal();
        showToast('Welcome, ' + (user.displayName || user.email) + '!', 'success');
    } catch (error) {
        let msg = 'Sign-in failed. Please try again.';
        if (error.code === 'auth/popup-closed-by-user') msg = 'Sign-in was cancelled.';
        else if (error.code === 'auth/network-request-failed') msg = 'Network error. Check your connection.';
        else if (error.code === 'auth/popup-blocked') msg = 'Popup was blocked. Please allow popups for this site.';
        else if (error.message) msg = error.message;
        errorDiv.textContent = msg;
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 48 48" style="margin-right:10px;"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.7 2.5 30.2 0 24 0 14.7 0 6.8 5.5 3 13.5l7.9 6.1C12.8 13.3 17.9 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/><path fill="#FBBC05" d="M10.9 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6L2.4 13.3A24 24 0 0 0 0 24c0 3.9.9 7.5 2.4 10.7l8.5-6.1z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2.1 1.4-4.7 2.3-7.7 2.3-6.1 0-11.2-3.8-13.1-9.2l-7.9 6.1C6.8 42.5 14.7 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>Continue with Google`;
    }
}

async function signOutCustomer() {
    try {
        await auth.signOut();
        closeUserMenu();
        showToast('You have signed out.', 'info');
    } catch (e) {
        showToast('Error signing out.', 'error');
    }
}

async function saveCustomerToFirestore(user) {
    try {
        const customerRef = db.collection('customers').doc(user.uid);
        const snap = await customerRef.get();
        const data = {
            name: user.displayName || '',
            email: user.email,
            photoURL: user.photoURL || '',
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!snap.exists) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await customerRef.set(data, { merge: true });
    } catch (e) {
        console.error('Error saving customer profile:', e);
    }
}

function updateAuthUI(user) {
    const loginBtn = document.getElementById('login-header-btn');
    const userInfo = document.getElementById('user-header-info');
    if (!loginBtn || !userInfo) return;

    if (user) {
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';

        const avatarImg = document.getElementById('user-avatar-img');
        const avatarInitials = document.getElementById('user-avatar-initials');
        if (user.photoURL) {
            avatarImg.src = user.photoURL;
            avatarImg.style.display = 'block';
            avatarInitials.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            const initials = (user.displayName || user.email || 'U')
                .split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            avatarInitials.textContent = initials;
            avatarInitials.style.display = 'flex';
        }
        document.getElementById('user-menu-name').textContent = user.displayName || 'Customer';
        document.getElementById('user-menu-email').textContent = user.email;
    } else {
        loginBtn.style.display = 'flex';
        userInfo.style.display = 'none';
    }
}

function openAuthModal() {
    document.getElementById('authModal').style.display = 'block';
    document.getElementById('auth-error').style.display = 'none';
}
function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}
function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}
function closeUserMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.style.display = 'none';
}

// Close user dropdown when clicking outside
document.addEventListener('click', (e) => {
    const userInfo = document.getElementById('user-header-info');
    const menu = document.getElementById('user-menu');
    if (menu && userInfo && !userInfo.contains(e.target)) {
        menu.style.display = 'none';
    }
});


async function openOrdersPanel() {
    if (!currentCustomer) {
        openAuthModal();
        return;
    }
    closeUserMenu();
    // Close cart drawer if open
    document.getElementById('cartDrawer').classList.remove('active');

    document.getElementById('ordersPanel').classList.add('active');
    document.getElementById('orders-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
    await loadCustomerOrders();
}

function closeOrdersPanel() {
    document.getElementById('ordersPanel').classList.remove('active');
    document.getElementById('orders-overlay').style.display = 'none';
    document.body.style.overflow = '';
}

async function loadCustomerOrders() {
    const body = document.getElementById('orders-panel-body');
    body.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
            <div style="font-size:32px;margin-bottom:12px;">⏳</div>
            <p style="color:#888;font-size:14px;">Loading your orders...</p>
        </div>`;

    try {
        const orders = await DB.getOrdersByCustomerEmail(currentCustomer.email);

        if (orders.length === 0) {
            body.innerHTML = `
                <div style="text-align:center;padding:60px 20px;">
                    <div style="font-size:52px;margin-bottom:16px;">🛍️</div>
                    <p style="font-size:16px;font-weight:600;margin-bottom:8px;">No orders yet</p>
                    <p style="color:#888;font-size:13px;line-height:1.6;">Place your first order.</p>
                </div>`;
            return;
        }

        orders.forEach(o => { o.createdAt = o.createdAt ? new Date(o.createdAt) : null; });

        const statusMap = {
            pending:    { cls: 'status-pending',    label: 'Pending' },
            processing: { cls: 'status-processing', label: 'Processing' },
            shipped:    { cls: 'status-shipped',    label: 'Shipped' },
            delivered:  { cls: 'status-delivered',  label: 'Delivered' },
            cancelled:  { cls: 'status-cancelled',  label: 'Cancelled' }
        };

        body.innerHTML = orders.map(order => {
            const dateStr = order.createdAt
                ? order.createdAt.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
                : 'Date unknown';

            const status = statusMap[order.status] || { cls: 'status-pending', label: order.status || 'Pending' };

            const itemsList = (order.items || []).map(item => `
                <div class="order-item-row">
                    <span>
                        ${item.name}
                        ${item.size ? `<span class="order-size-tag">${item.size}</span>` : ''}
                        <span style="color:#888;font-size:12px;">× ${item.quantity}</span>
                    </span>
                    <span style="font-weight:600;">₱${(item.price * item.quantity).toLocaleString()}</span>
                </div>`).join('');

            const canCancel = order.status === 'pending';

            return `
                <div class="customer-order-card">
                    <div class="customer-order-header">
                        <div>
                            <div class="customer-order-id">Order #${order.id.substring(0, 8).toUpperCase()}</div>
                            <div class="customer-order-date">${dateStr}</div>
                        </div>
                        <span class="status-badge ${status.cls}">${status.label}</span>
                    </div>
                    <div class="customer-order-items">${itemsList}</div>
                    <div class="customer-order-footer">
                        <div>
                            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Payment</div>
                            <div style="font-size:13px;font-weight:600;">${(order.paymentMethod || 'cod').toUpperCase()}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Total</div>
                            <div style="font-weight:700;font-size:20px;font-family:'Bebas Neue',sans-serif;letter-spacing:1px;">₱${(order.total || 0).toLocaleString()}</div>
                        </div>
                    </div>
                    ${canCancel ? `
                    <div style="padding:12px 16px; border-top:1px solid #eee; text-align:right;">
                        <button onclick="cancelOrder('${order.id}')" 
                                style="background:#e20b1d; color:white; border:none; padding:9px 18px; border-radius:4px; cursor:pointer; font-size:13px; font-weight:600;">
                            Cancel Order
                        </button>
                    </div>` : ''}
                </div>`;
        }).join('');

    } catch (error) {
        console.error('Error loading orders:', error);
        const body = document.getElementById('orders-panel-body');
        body.innerHTML = `
            <div style="text-align:center;padding:40px 20px;">
                <div style="font-size:36px;margin-bottom:12px;">⚠️</div>
                <p style="font-weight:700;font-size:15px;margin-bottom:8px;color:#e20b1d;">Error loading orders</p>
                <p style="font-size:13px;color:#888;">${error.message}</p>
                <button onclick="loadCustomerOrders()" style="margin-top:15px;padding:10px 20px;background:#000;color:#fff;border:none;cursor:pointer;">Retry</button>
            </div>`;
    }
}


function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    if (!toast) return;
    toastMessage.innerText = message;
    toast.className = 'toast show ' + type;
    setTimeout(() => toast.classList.remove('show'), 3500);
}


async function loadProducts() {
    try {
        const allProductsFromDB = await DB.getProducts();
        allProducts = showOnlyActive ? allProductsFromDB.filter(p => p.active) : allProductsFromDB;
        filteredProducts = [...allProducts];
        sortProducts(currentSort);
        displayProducts();
    } catch (e) {
        console.error('Error loading products:', e);
    }
}

function toggleShowAll() {
    showOnlyActive = !showOnlyActive;
    const btn = document.getElementById('toggle-show-all');
    if (btn) btn.innerText = showOnlyActive ? 'Show All Products' : 'Show Active Only';
    loadProducts();
}

function displayProducts() {
    const grid = document.getElementById('product-grid');
    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px 20px;">
                <p style="font-size:18px;color:#888;margin-bottom:10px;">No products found</p>
                <p style="font-size:14px;color:#aaa;">Try adjusting your filters or check back later</p>
                <button onclick="clearFilters()" style="margin-top:20px;padding:10px 20px;background:#000;color:#fff;border:none;cursor:pointer;">Clear Filters</button>
            </div>`;
        return;
    }

    grid.innerHTML = filteredProducts.map(product => {
        const discountedPrice = product.discount > 0
            ? product.price * (1 - product.discount / 100)
            : product.price;
        const imageStyle = product.image
            ? `background-image:url('${product.image}');`
            : `background:linear-gradient(135deg,#f5f5f5 0%,#e0e0e0 100%);display:flex;align-items:center;justify-content:center;color:#999;font-weight:600;font-size:14px;`;
        const imageContent = product.image ? '' : '<div>No Image</div>';

        return `
            <div class="product-card">
                ${product.discount > 0 ? `<div class="badge-discount">${product.discount}% OFF</div>` : ''}
                <div class="prod-img" style="${imageStyle}">${imageContent}</div>
                <div class="prod-details">
                    <p class="prod-title">${product.name}</p>
                    <div class="price-row">
                        <span class="price">₱${discountedPrice.toLocaleString()}</span>
                        <span class="sold">${formatSold(product.sold)} sold</span>
                    </div>
                    ${product.sizes && product.sizes.length > 0 ? `
                    <div class="size-selector" style="margin-bottom:8px;">
                        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;color:#555;">Size</div>
                        <div style="display:flex;gap:5px;flex-wrap:wrap;">
                            ${product.sizes.map(size =>
                                `<button class="size-btn" onclick="selectSize(this,'${product.id}')" data-size="${size}">${size}</button>`
                            ).join('')}
                        </div>
                    </div>` : ''}
                    ${product.stock > 0
                        ? `<button class="add-btn" onclick="addToCart('${product.id}')">Add to Cart</button>`
                        : `<button class="add-btn" disabled style="background:#ccc;cursor:not-allowed;">Out of Stock</button>`
                    }
                </div>
            </div>`;
    }).join('');
}

function formatSold(count) {
    if (!count) return 0;
    if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
    return count;
}

function sortProducts(type) {
    currentSort = type;
    document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');

    switch (type) {
        case 'popular':    filteredProducts.sort((a, b) => (b.sold || 0) - (a.sold || 0)); break;
        case 'latest':     filteredProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
        case 'price-low':  filteredProducts.sort((a, b) => (a.price * (1 - a.discount / 100)) - (b.price * (1 - b.discount / 100))); break;
        case 'price-high': filteredProducts.sort((a, b) => (b.price * (1 - b.discount / 100)) - (a.price * (1 - a.discount / 100))); break;
    }
    displayProducts();
}

function applyFilters() {
    const checkedCategories = Array.from(
        document.querySelectorAll('.filter-group input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    const minPrice = parseInt(document.getElementById('min-price').value) || 0;
    const maxPrice = parseInt(document.getElementById('max-price').value) || Infinity;

    filteredProducts = allProducts.filter(product => {
        const price = product.price * (1 - product.discount / 100);
        const categoryMatch = checkedCategories.length === 0 || checkedCategories.includes(product.category);
        const priceMatch = price >= minPrice && price <= maxPrice;
        return categoryMatch && priceMatch;
    });
    sortProducts(currentSort);
}

function clearFilters() {
    document.querySelectorAll('.filter-group input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('min-price').value = '';
    document.getElementById('max-price').value = '';
    filteredProducts = [...allProducts];
    sortProducts(currentSort);
}

function searchProducts() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    filteredProducts = query
        ? allProducts.filter(p =>
            p.name.toLowerCase().includes(query) ||
            (p.category || '').toLowerCase().includes(query) ||
            (p.description || '').toLowerCase().includes(query)
        )
        : [...allProducts];
    sortProducts(currentSort);
}

document.getElementById('search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchProducts();
});

const selectedSizes = {};

function selectSize(btn, productId) {
    btn.closest('.size-selector').querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedSizes[productId] = btn.dataset.size;
}


function toggleCart() {
    const drawer = document.getElementById('cartDrawer');
    drawer.classList.toggle('active');
    // Close orders panel if open
    if (drawer.classList.contains('active')) {
        closeOrdersPanel();
    }
}

async function addToCart(productId) {
    const product = await DB.getProduct(productId);
    if (!product || product.stock <= 0) return;

    const hasSizes = product.sizes && product.sizes.length > 0;
    const selectedSize = selectedSizes[productId];

    if (hasSizes && !selectedSize) {
        const card = [...document.querySelectorAll('.product-card')]
            .find(c => c.querySelector(`[onclick="addToCart('${productId}')"]`));
        if (card) {
            const sizeSelector = card.querySelector('.size-selector');
            if (sizeSelector) {
                sizeSelector.style.outline = '2px solid #e20b1d';
                sizeSelector.style.borderRadius = '4px';
                setTimeout(() => sizeSelector.style.outline = '', 1200);
            }
        }
        showToast('Please select a size first.', 'error');
        return;
    }

    const cartKey = hasSizes ? `${productId}-${selectedSize}` : productId;
    const existingItem = cart.find(item => item.cartKey === cartKey);

    if (existingItem) {
        if (existingItem.quantity >= product.stock) {
            showToast('No more stock available.', 'error');
            return;
        }
        existingItem.quantity += 1;
    } else {
        const discountedPrice = product.discount > 0
            ? product.price * (1 - product.discount / 100)
            : product.price;
        cart.push({
            cartKey,
            productId: product.id,
            name: product.name,
            price: discountedPrice,
            image: product.image,
            size: selectedSize || null,
            quantity: 1
        });
    }

    saveCart();
    updateCartUI();
    // Open cart drawer
    document.getElementById('cartDrawer').classList.add('active');
    closeOrdersPanel();
}

function removeItem(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

async function increaseQuantity(index) {
    const item = cart[index];
    const product = await DB.getProduct(item.productId);
    if (!product || item.quantity >= product.stock) {
        showToast('No more stock available.', 'error');
        return;
    }
    item.quantity += 1;
    saveCart();
    updateCartUI();
}

function decreaseQuantity(index) {
    if (cart[index].quantity > 1) {
        cart[index].quantity -= 1;
        saveCart();
        updateCartUI();
    } else {
        removeItem(index);
    }
}

function updateCartUI() {
    const cartItems = document.getElementById('cart-items');
    const badge = document.getElementById('cart-badge');
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    badge.innerText = totalItems;
    document.getElementById('cart-total').innerText = `₱${total.toLocaleString()}`;

    // Update checkout button based on login state
    const checkoutBtn = document.querySelector('.cart-footer .checkout-btn');
    if (checkoutBtn) {
        if (currentCustomer) {
            checkoutBtn.innerHTML = 'Checkout Now';
            checkoutBtn.onclick = checkout;
            checkoutBtn.style.background = '';
            checkoutBtn.style.opacity = '1';
        } else {
            checkoutBtn.innerHTML = 'Sign in to Checkout';
            checkoutBtn.onclick = () => {
                document.getElementById('cartDrawer').classList.remove('active');
                openAuthModal();
                showToast('Please sign in to place an order.', 'info');
            };
            checkoutBtn.style.background = '#333';
        }
    }

    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align:center;color:#888;margin-top:40px;">Your bag is empty.</p>';
    } else {
        cartItems.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <div class="cart-item-img" style="background-image:url('${item.image || ''}');background-size:cover;background-position:center;"></div>
                <div class="cart-item-details">
                    <div class="cart-item-name">
                        ${item.name}
                        ${item.size ? `<span style="font-size:11px;background:#000;color:#fff;padding:2px 6px;border-radius:2px;margin-left:4px;">${item.size}</span>` : ''}
                    </div>
                    <div class="cart-item-price">₱${item.price.toLocaleString()} × ${item.quantity}</div>
                    <div style="display:flex;gap:10px;align-items:center;margin-top:8px;">
                        <button class="quantity-btn" onclick="decreaseQuantity(${index})">−</button>
                        <span style="font-weight:600;min-width:20px;text-align:center;">${item.quantity}</span>
                        <button class="quantity-btn" onclick="increaseQuantity(${index})">+</button>
                    </div>
                    <button class="cart-item-remove" onclick="removeItem(${index})">Remove</button>
                </div>
            </div>`).join('');
    }
}

function saveCart() { localStorage.setItem('lihim_cart', JSON.stringify(cart)); }
function loadCart() {
    const saved = localStorage.getItem('lihim_cart');
    if (saved) { cart = JSON.parse(saved); updateCartUI(); }
}


function checkout() {
    if (cart.length === 0) return;

    // ── Require login to checkout ─────────────────────────────────────────
    if (!currentCustomer) {
        // Close cart and open login modal with a friendly message
        document.getElementById('cartDrawer').classList.remove('active');
        openAuthModal();
        showToast('Please sign in to place an order.', 'info');
        return;
    }

    // Close cart, open checkout
    document.getElementById('cartDrawer').classList.remove('active');

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 50;
    const total = subtotal + shipping;

    document.getElementById('checkout-items').innerHTML = cart.map(item => `
        <div class="checkout-item">
            <span>${item.name}${item.size ? ` (${item.size})` : ''} × ${item.quantity}</span>
            <span>₱${(item.price * item.quantity).toLocaleString()}</span>
        </div>`).join('');

    document.getElementById('checkout-subtotal').innerText = `₱${subtotal.toLocaleString()}`;
    document.getElementById('checkout-total').innerText = `₱${total.toLocaleString()}`;

    // Pre-fill if logged in
    if (currentCustomer) {
        const form = document.getElementById('checkout-form');
        if (form.elements[0]) form.elements[0].value = currentCustomer.displayName || '';
        if (form.elements[1]) form.elements[1].value = currentCustomer.email || '';
    }

    document.getElementById('checkoutModal').style.display = 'block';
}

function closeCheckout() {
    document.getElementById('checkoutModal').style.display = 'none';
}

async function processOrder(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;

    submitButton.disabled = true;
    submitButton.textContent = 'Processing Order...';

    try {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const shipping = 50;           // Match the UI
        const total = subtotal + shipping;

        const order = {
            customer: {
                name: form.elements[0].value.trim(),
                email: form.elements[1].value.trim(),
                phone: form.elements[2].value.trim(),
                address: form.elements[3].value.trim()
            },
            items: cart.map(item => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                size: item.size || null,
                quantity: item.quantity
            })),
            subtotal: subtotal,
            shipping: shipping,
            total: total,
            paymentMethod: form.elements[4].value
        };

        console.log('Placing order...', order);

        const savedOrder = await DB.addOrder(order);

        if (savedOrder && savedOrder.id) {
            console.log('✅ Order saved successfully!', savedOrder.id);

            // Clear cart
            cart = [];
            saveCart();
            updateCartUI();

            // Close everything
            closeCheckout();
            document.getElementById('cartDrawer').classList.remove('active');

            showToast('Order placed successfully! Thank you for shopping with Lihim.', 'success');
            form.reset();
        } else {
            throw new Error('Failed to save order to database');
        }

    } catch (error) {
        console.error('❌ Order placement error:', error);
        showToast('Failed to place order. Please try again.', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
    }
}

window.onclick = function(event) {
    const checkoutModal = document.getElementById('checkoutModal');
    const authModal = document.getElementById('authModal');
    if (event.target === checkoutModal) closeCheckout();
    if (event.target === authModal) closeAuthModal();
};

window.cancelOrder = async function(orderId) {
    try {
        const order = await DB.getOrder(orderId);
        if (!order) {
            showToast('Order not found.', 'error');
            return;
        }

        const batch = db.batch();

        for (const item of order.items) {
            const productRef = db.collection('products').doc(item.productId);
            const productDoc = await productRef.get();

            if (productDoc.exists) {
                const qty = item.quantity || 1;
                const currentStock = productDoc.data().stock || 0;
                const currentSold = productDoc.data().sold || 0;

                batch.update(productRef, {
                    stock: currentStock + qty,
                    sold: Math.max(0, currentSold - qty)
                });
            }
        }

        // Update order status
        const orderRef = db.collection('orders').doc(orderId);
        batch.update(orderRef, { status: 'cancelled' });

        await batch.commit();

        showToast('Order cancelled successfully. Stock has been restored.', 'success');
        
        await loadCustomerOrders();   

    } catch (error) {
        console.error('Cancel order error:', error);
        showToast('Failed to cancel order. Please try again.', 'error');
    }
};
