// admin.js
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

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
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    
    const confirmBtn = document.getElementById('confirm-action-btn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    
    newBtn.addEventListener('click', () => {
        closeConfirmModal();
        onConfirm();
    });
    modal.style.display = 'block';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

// ====================== AUTHENTICATION ======================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin panel loaded...');

    onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user ? user.email : 'No user');
        
        if (user) {
            if (!isAuthorizedAdmin(user.email)) {
                console.warn('Unauthorized access:', user.email);
                await signOut(auth);
                showLogin();
                document.getElementById('login-error').innerText = 'Access denied. You are not authorized.';
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
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    document.getElementById('admin-email').innerText = user.email;
    
    showTab('products');
    try {
        await loadProducts();
        await loadOrders();
        await loadAnalytics();
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Error loading data. Please refresh.', 'error');
    }
}

async function loginAdmin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
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
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error(error);
        errorDiv.innerText = 'Login failed. Check your credentials.';
        errorDiv.classList.add('show');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'LOGIN';
    }
}

async function logoutAdmin() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out.', 'error');
    }
}

// ====================== TAB & OTHER FUNCTIONS ======================
function showTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// ... (I'll keep your other functions like loadProducts, saveProduct, etc. the same for now)

async function loadProducts() {
    // Your existing loadProducts function (unchanged for now)
    console.log('Admin: Loading all products...');
    try {
        if (typeof DB === 'undefined') {
            showToast('Database not initialized.', 'error');
            return;
        }
        const products = await DB.getProducts();
        // ... rest of your code
    } catch (error) {
        console.error(error);
    }
}

// Keep all your other functions (loadOrders, saveProduct, etc.) as they are for now.
// We will fix the DB part next.

window.loginAdmin = loginAdmin;
window.logoutAdmin = logoutAdmin;
window.showTab = showTab;
// ... add other window. assignments for onclick functions
