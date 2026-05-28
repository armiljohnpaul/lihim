let currentTab = 'products';
let currentOrderFilter = 'all';
let currentUser = null;

const AUTHORIZED_ADMINS = [
    'sendrijasmelchor@gmail.com',
    'lobetejohnryzel75@gmail.com'
];

function isAuthorizedAdmin(email) {
    return AUTHORIZED_ADMINS.includes(email.toLowerCase().trim());
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    toastMessage.innerText = message;
    toast.className = 'toast show ' + type;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Show confirmation modal
function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const confirmBtn = document.getElementById('confirm-action-btn');
    
    titleEl.innerText = title;
    messageEl.innerText = message;
    
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    newConfirmBtn.addEventListener('click', () => {
        closeConfirmModal();
        onConfirm();
    });
    
    modal.style.display = 'block';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}


document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin panel loaded, setting up authentication...');
    
    if (typeof firebase === 'undefined') {
        console.error('Firebase is not loaded! Check your script tags.');
        return;
    }
    
    if (typeof auth === 'undefined') {
        console.error('Firebase Auth is not initialized! Check firebase-config.js');
        return;
    }
    
    auth.onAuthStateChanged(async (user) => {
        console.log('Auth state changed:', user ? user.email : 'No user');
        if (user) {
            if (!isAuthorizedAdmin(user.email)) {
                console.warn('Unauthorized access attempt:', user.email);
                await auth.signOut();
                showLogin();
                const errorDiv = document.getElementById('login-error');
                errorDiv.innerText = 'Access denied. You are not authorized to access this panel.';
                errorDiv.classList.add('show');
                return;
            }
            currentUser = user;
            showDashboard(user);
        } else {
            showLogin();
        }
    });
});

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-dashboard').style.display = 'none';
}

async function showDashboard(user) {
    console.log('Showing dashboard for:', user.email);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    document.getElementById('admin-email').innerText = user.email;

    showTab('products');

    try {
        await loadProducts();
        await loadOrders();
        await loadAnalytics();
    } catch (error) {
        console.error('Error loading admin data:', error);
        showToast('Error loading data. Please refresh the page.', 'error');
    }
}

async function loginAdmin(event) {
    event.preventDefault();

    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    errorDiv.classList.remove('show');
    errorDiv.innerText = '';

    if (!isAuthorizedAdmin(email)) {
        errorDiv.innerText = 'Access denied.';
        errorDiv.classList.add('show');
        return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        console.error(error); 
        errorDiv.innerText = 'Login failed.';
        errorDiv.classList.add('show');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
    }
}

async function logoutAdmin() {
    try {
        await auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out. Please try again.', 'error');
    }
}

function showTab(tabName) {
    currentTab = tabName;

    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    document.querySelectorAll('.admin-nav a').forEach(link => {
        link.style.borderColor = 'transparent';
    });
    
    if (event && event.target) {
        event.target.style.borderColor = '#fff';
    }
}

let allAdminProducts = [];
let currentProductFilter = 'all';
async function loadProducts() {
    console.log('Admin: Loading all products...');
    
    try {
        if (typeof DB === 'undefined') {
            console.error('DB is not defined! Firebase not initialized.');
            showToast('Database not initialized. Please refresh the page.', 'error');
            return;
        }
        
        if (typeof DB.getProducts !== 'function') {
            console.error('DB.getProducts is not a function!');
            showToast('Database error. Please refresh the page.', 'error');
            return;
        }
        
        allAdminProducts = await DB.getProducts();
        console.log('Admin: Total products loaded:', allAdminProducts.length);
        console.log('Admin: Products:', allAdminProducts);
        console.log('Admin: Active products:', allAdminProducts.filter(p => p.active).length);
        console.log('Admin: Inactive products:', allAdminProducts.filter(p => !p.active).length);
        
        updateProductStats();

        displayFilteredProducts();
        
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Error loading products: ' + error.message, 'error');

        const tbody = document.getElementById('products-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #e20b1d;">
                        <p><strong>Error loading products</strong></p>
                        <p style="font-size: 14px; margin-top: 10px;">${error.message}</p>
                        <button onclick="loadProducts()" style="margin-top: 15px; padding: 10px 20px; background: #000; color: #fff; border: none; cursor: pointer;">Retry</button>
                    </td>
                </tr>
            `;
        }
    }
}

function updateProductStats() {
    const total = allAdminProducts.length;
    const active = allAdminProducts.filter(p => p.active).length;
    const inactive = total - active;
    
    document.getElementById('stat-total').innerText = total;
    document.getElementById('stat-active').innerText = active;
    document.getElementById('stat-inactive').innerText = inactive;
    document.getElementById('products-count').innerText = `(${total} total)`;
}

function filterProductsByStatus() {
    currentProductFilter = document.getElementById('filter-status').value;
    displayFilteredProducts();
}

function displayFilteredProducts() {
    const tbody = document.getElementById('products-tbody');

    let productsToShow = allAdminProducts;
    if (currentProductFilter === 'active') {
        productsToShow = allAdminProducts.filter(p => p.active);
    } else if (currentProductFilter === 'inactive') {
        productsToShow = allAdminProducts.filter(p => !p.active);
    }
    
    console.log('Displaying products. Filter:', currentProductFilter, 'Count:', productsToShow.length);
    
    const countElement = document.getElementById('products-count');
    if (countElement) {
        if (currentProductFilter === 'all') {
            countElement.innerText = `(${allAdminProducts.length} total)`;
        } else {
            countElement.innerText = `(${productsToShow.length} ${currentProductFilter})`;
        }
    }
    
    if (productsToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #888;">No products match this filter. Try "Show All Products"</td></tr>';
        return;
    }
    
    tbody.innerHTML = productsToShow.map(product => {
        const discountedPrice = product.discount > 0 
            ? product.price * (1 - product.discount / 100) 
            : product.price;
        
        const imageStyle = product.image 
            ? `background-image: url('${product.image}');` 
            : `background-color: #eee; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10px;`;
        const imageContent = product.image ? '' : '<div style="padding: 5px;">No Image</div>';
        
        return `
            <tr>
                <td><div class="product-img-thumb" style="${imageStyle}">${imageContent}</div></td>
                <td>${product.name}</td>
                <td>${product.category}</td>
                <td>₱${discountedPrice.toLocaleString()}${product.discount > 0 ? ` <small style="color: #888; text-decoration: line-through;">₱${product.price.toLocaleString()}</small>` : ''}</td>
                <td>${product.stock}</td>
                <td>${product.sold}</td>
                <td><span class="status-badge ${product.active ? 'status-active' : 'status-inactive'}">${product.active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="action-btn" onclick="editProduct('${product.id}')">Edit</button>
                    <button class="action-btn delete" onclick="deleteProduct('${product.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function openAddProduct() {
    document.getElementById('product-modal-title').innerText = 'Add New Product';
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-image').value = '';
    document.getElementById('product-image-path').value = '';
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('productModal').style.display = 'block';
}

function previewImage(input) {
    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        
        reader.readAsDataURL(input.files[0]);
    }
}

async function editProduct(id) {
    const product = await DB.getProduct(id);
    if (!product) return;
    
    document.getElementById('product-modal-title').innerText = 'Edit Product';
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-cost').value = product.cost || 0;
    document.getElementById('product-stock').value = product.stock;
    document.getElementById('product-discount').value = product.discount || 0;
    document.getElementById('product-image').value = product.image || '';
    document.getElementById('product-image-path').value = product.imagePath || '';
    document.getElementById('product-description').value = product.description || '';
    document.getElementById('product-active').checked = product.active;
    
    if (product.image) {
        const preview = document.getElementById('image-preview');
        const previewImg = document.getElementById('preview-img');
        previewImg.src = product.image;
        preview.style.display = 'block';
    }
    
    document.getElementById('productModal').style.display = 'block';
}

async function saveProduct(event) {
    event.preventDefault();
    
    const productId = document.getElementById('product-id').value;
    const productName = document.getElementById('product-name').value;
    const imageFile = document.getElementById('product-image-file').files[0];
    const existingImageUrl = document.getElementById('product-image').value;
    const existingImagePublicId = document.getElementById('product-image-path').value;
    
    let imageUrl = existingImageUrl || '';
    let imagePublicId = existingImagePublicId || '';

    if (imageFile) {
        const progressDiv = document.getElementById('upload-progress');
        const progressBar = document.getElementById('progress-bar');
        
        progressDiv.style.display = 'block';
        progressBar.style.width = '50%';
        
        const uploadResult = await DB.uploadImage(imageFile, productName);
        
        if (!uploadResult.success) {
            progressDiv.style.display = 'none';
            showToast('Error uploading image: ' + uploadResult.error, 'error');
            return;
        }
        
        if (productId && existingImagePublicId) {
            await DB.deleteImage(existingImagePublicId);
        }
        
        imageUrl = uploadResult.url;
        imagePublicId = uploadResult.publicId;
        progressBar.style.width = '100%';
    }
    
    const productData = {
        name: productName,
        category: document.getElementById('product-category').value,
        price: parseFloat(document.getElementById('product-price').value),
        cost: parseFloat(document.getElementById('product-cost').value) || 0,
        stock: parseInt(document.getElementById('product-stock').value),
        discount: parseInt(document.getElementById('product-discount').value) || 0,
        image: imageUrl,
        imagePublicId: imagePublicId,
        description: document.getElementById('product-description').value,
        active: document.getElementById('product-active').checked
    };
    
    if (productId) {
        console.log('Updating product:', productId, productData);
        await DB.updateProduct(productId, productData);
        console.log('Product updated successfully');
        showToast('Product updated successfully', 'success');
    } else {
        console.log('Adding new product:', productData);
        const result = await DB.addProduct(productData);
        console.log('Product added successfully:', result);
        showToast('Product added successfully', 'success');
    }
    
    document.getElementById('upload-progress').style.display = 'none';
    document.getElementById('progress-bar').style.width = '0%';
    
    closeProductModal();
    
    console.log('Reloading products after save...');
    await loadProducts();
    await loadAnalytics();
    console.log('Products reloaded');
}

async function deleteProduct(id) {
    const product = await DB.getProduct(id);
    if (!product) {
        showToast('Product not found', 'error');
        return;
    }
    
    showConfirm(
        'Delete Product',
        `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
        async () => {
            console.log('Deleting product:', id);

            if (product.imagePublicId) {
                await DB.deleteImage(product.imagePublicId);
            }
            
            const success = await DB.deleteProduct(id);
            
            if (success) {
                showToast('Product deleted successfully', 'success');
                await loadProducts();
                await loadAnalytics();
            } else {
                showToast('Failed to delete product', 'error');
            }
        }
    );
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
}

async function loadOrders() {
    console.log('Admin: Loading orders...');
    
    try {
        let orders = await DB.getOrders();
        console.log('Admin: Total orders loaded:', orders.length);
        
        if (currentOrderFilter !== 'all') {
            orders = orders.filter(o => o.status === currentOrderFilter);
            console.log('Admin: Filtered orders (' + currentOrderFilter + '):', orders.length);
        }
        
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        const tbody = document.getElementById('orders-tbody');
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #888;">No orders yet</td></tr>';
            return;
        }
        
        tbody.innerHTML = orders.map(order => {
        const date = new Date(order.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        return `
            <tr>
                <td><strong>${order.id}</strong></td>
                <td>
                    ${order.customer.name}<br>
                    <small style="color: #888;">${order.customer.email}</small>
                </td>
                <td>${order.items.length} item${order.items.length > 1 ? 's' : ''}</td>
                <td><strong>₱${order.total.toLocaleString()}</strong></td>
                <td>${date}</td>
                <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                <td>
                    <button class="action-btn" onclick="viewOrder('${order.id}')">View</button>
                    <select onchange="updateOrderStatus('${order.id}', this.value)" style="padding: 5px; font-size: 12px; margin-left: 5px;">
                        <option value="">Change Status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');
    
    console.log('Admin: Orders displayed successfully');
    
    } catch (error) {
        console.error('Error loading orders:', error);
        const tbody = document.getElementById('orders-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #e20b1d;">
                        <p><strong>Error loading orders</strong></p>
                        <p style="font-size: 14px; margin-top: 10px;">${error.message}</p>
                        <button onclick="loadOrders()" style="margin-top: 15px; padding: 10px 20px; background: #000; color: #fff; border: none; cursor: pointer;">Retry</button>
                    </td>
                </tr>
            `;
        }
    }
}

function filterOrders(status) {
    currentOrderFilter = status;
    loadOrders();
}

async function viewOrder(id) {
    const order = await DB.getOrder(id);
    if (!order) return;
    
    const date = new Date(order.createdAt).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const details = `
        <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 10px;">Order #${order.id}</h3>
            <p style="color: #888; margin-bottom: 5px;">${date}</p>
            <span class="status-badge status-${order.status}">${order.status}</span>
        </div>
        
        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 10px;">Customer Information</h4>
            <p><strong>Name:</strong> ${order.customer.name}</p>
            <p><strong>Email:</strong> ${order.customer.email}</p>
            <p><strong>Phone:</strong> ${order.customer.phone}</p>
            <p><strong>Address:</strong><br>${order.customer.address}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 10px;">Order Items</h4>
            ${order.items.map(item => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding: 10px; background: #f9f9f9;">
                    <span>${item.name} ${item.quantity ? `× ${item.quantity}` : ''}</span>
                    <span><strong>₱${(item.price * (item.quantity || 1)).toLocaleString()}</strong></span>
                </div>
            `).join('')}
        </div>
        
        <div style="background: #f9f9f9; padding: 15px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Subtotal:</span>
                <span>₱${order.subtotal.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Shipping:</span>
                <span>₱${order.shipping.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #000; font-size: 18px; font-weight: 700;">
                <span>Total:</span>
                <span>₱${order.total.toLocaleString()}</span>
            </div>
        </div>
        
        <div>
            <h4 style="margin-bottom: 10px;">Payment Method</h4>
            <p>${order.paymentMethod.toUpperCase()}</p>
        </div>
    `;
    
    document.getElementById('order-details').innerHTML = details;
    document.getElementById('orderModal').style.display = 'block';
}

// ====================== UPDATE ORDER STATUS (Admin) - with Stock Restoration ======================
async function updateOrderStatus(orderId, newStatus) {
    if (!newStatus) return;

    try {
        if (newStatus === 'cancelled') {
            const order = await DB.getOrder(orderId);
            if (!order) {
                showToast('Order not found.', 'error');
                return;
            }

            const batch = db.batch();

            // Restore stock for each item
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
            showToast('✅ Order cancelled and stock restored.', 'success');

        } else {
            // Normal status update (no stock change)
            await DB.updateOrder(orderId, { status: newStatus });
            showToast(`Order status updated to ${newStatus}`, 'success');
        }

        // Refresh the orders list
        await loadOrders();

    } catch (error) {
        console.error('Update order status error:', error);
        showToast('❌ Failed to update order status.', 'error');
    }
}

function closeOrderModal() {
    document.getElementById('orderModal').style.display = 'none';
}

async function loadAnalytics() {
    console.log('Admin: Loading analytics...');
    
    try {
        const analytics = await DB.getAnalytics();
        const products = await DB.getProducts();
        console.log('Admin: Analytics loaded:', analytics);
        
        document.getElementById('total-revenue').innerText = `₱${analytics.totalRevenue.toLocaleString()}`;
        document.getElementById('total-orders').innerText = analytics.totalOrders;
        document.getElementById('total-products').innerText = analytics.totalProducts;
        document.getElementById('avg-order').innerText = `₱${Math.round(analytics.avgOrder).toLocaleString()}`;

        let totalProfit = 0;
        let marginsWithData = [];

        products.forEach(p => {
            if (p.cost != null && p.sold > 0) {
                const sellingPrice = p.price * (1 - (p.discount || 0) / 100);
                const profitPerUnit = sellingPrice - p.cost;
                totalProfit += profitPerUnit * p.sold;
                if (p.cost > 0) {
                    marginsWithData.push((profitPerUnit / sellingPrice) * 100);
                }
            }
        });

        const avgMargin = marginsWithData.length > 0
            ? marginsWithData.reduce((a, b) => a + b, 0) / marginsWithData.length
            : 0;

        document.getElementById('total-profit').innerText = `₱${Math.round(totalProfit).toLocaleString()}`;
        document.getElementById('avg-margin').innerText = `${Math.round(avgMargin)}%`;

        const topProductsDiv = document.getElementById('top-products');
        
        if (analytics.topProducts.length === 0) {
            topProductsDiv.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">No sales data yet</p>';
            return;
        }
        
        topProductsDiv.innerHTML = analytics.topProducts.map((product, index) => {
            const fullProduct = products.find(p => p.id === product.id) || product;
            const sellingPrice = product.price * (1 - (product.discount || 0) / 100);
            const hasCost = fullProduct.cost != null && fullProduct.cost > 0;
            const profitPerUnit = hasCost ? sellingPrice - fullProduct.cost : null;
            const totalProductProfit = hasCost ? profitPerUnit * product.sold : null;
            const margin = hasCost ? (profitPerUnit / sellingPrice) * 100 : null;

            return `
            <div class="top-product-item">
                <div>
                    <div style="font-size: 24px; color: #888; margin-bottom: 5px;">#${index + 1}</div>
                    <div class="top-product-info">${product.name}</div>
                    <div style="font-size: 12px; color: #888; margin-top: 3px;">${product.category}</div>
                    ${hasCost
                        ? `<div style="font-size:12px; color:#888; margin-top:3px;">Cost: ₱${fullProduct.cost.toLocaleString()} &nbsp;|&nbsp; Profit/unit: <span style="color:#28a745; font-weight:600;">₱${Math.round(profitPerUnit).toLocaleString()}</span> &nbsp;|&nbsp; Margin: <span style="color:#17a2b8; font-weight:600;">${Math.round(margin)}%</span></div>`
                        : '<div style="font-size:11px; color:#bbb; margin-top:3px;">No cost set</div>'
                    }
                </div>
                <div style="text-align: right;">
                    <div class="top-product-sales">${product.sold} sold</div>
                    <div style="font-size: 14px; color: #888;">₱${sellingPrice.toLocaleString()}</div>
                    ${totalProductProfit !== null ? `<div style="font-size:13px; color:#28a745; font-weight:600; margin-top:4px;">₱${Math.round(totalProductProfit).toLocaleString()} profit</div>` : ''}
                </div>
            </div>
        `}).join('');

        console.log('Admin: Analytics displayed successfully');

    } catch (error) {
        console.error('Error loading analytics:', error);
        showToast('Error loading analytics: ' + error.message, 'error');
    }
}

window.onclick = function(event) {
    const productModal = document.getElementById('productModal');
    const orderModal = document.getElementById('orderModal');
    
    if (event.target === productModal) {
        closeProductModal();
    }
    if (event.target === orderModal) {
        closeOrderModal();
    }
}
