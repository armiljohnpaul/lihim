// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBp1yaLCexKOglNcMh3-ppnGvV3pN_7ulY",
    authDomain: "lihim-clothing-2f635.firebaseapp.com",
    projectId: "lihim-clothing-2f635",
    storageBucket: "lihim-clothing-2f635.firebasestorage.app",
    messagingSenderId: "791415987673",
    appId: "1:791415987673:web:06af7ea1142ca47f738dc8"
};

const CLOUDINARY_CONFIG = {
    cloudName: "dtvyptdyf",
    uploadPreset: "lihim_products"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

//  Admin email whitelist
const ADMIN_EMAILS = [
    'sendrijasmelchor@gmail.com',
    'lobetejohnryzel75@gmail.com'
];

const DB = {
    productsCollection: db.collection('products'),
    ordersCollection:   db.collection('orders'),

    async init() {
        console.log('Database initialized successfully');
    },

    _toDate(ts) {
        // Handles Firestore Timestamp, plain Date, ISO string, or null
        if (!ts) return null;
        if (typeof ts.toDate === 'function') return ts.toDate();
        if (ts instanceof Date) return ts;
        return new Date(ts);
    },

    _orderFromDoc(doc) {
        const data = doc.data();
        const createdAt = this._toDate(data.createdAt);
        return {
            id: doc.id,
            ...data,
            createdAt: createdAt ? createdAt.toISOString() : new Date().toISOString()
        };
    },

    // Cloudinary

    async uploadImage(file, productName) {
        try {
            if (!file) return { success: false, error: 'No file provided' };
            if (file.size > 10 * 1024 * 1024) return { success: false, error: 'File too large (max 10MB)' };

            const validTypes = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
            if (!validTypes.includes(file.type)) return { success: false, error: 'Invalid file type. Use JPG, PNG, WEBP, or GIF' };

            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            formData.append('folder', 'lihim-products');
            formData.append('public_id', `${productName.replace(/[^a-z0-9]/gi,'_').toLowerCase()}_${Date.now()}`);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
                { method: 'POST', body: formData }
            );

            if (!response.ok) {
                const err = await response.json();
                return { success: false, error: err.error?.message || 'Upload failed' };
            }
            const data = await response.json();
            return { success: true, url: data.secure_url, publicId: data.public_id };
        } catch (error) {
            return { success: false, error: error.message || 'Upload failed' };
        }
    },

    async deleteImage(publicId) {
        console.log('Image deletion requires backend API key. Public ID:', publicId);
    },

    async getProducts() {
        try {
            const snapshot = await this.productsCollection.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting products:', error);
            return [];
        }
    },

    async getProduct(id) {
        try {
            const doc = await this.productsCollection.doc(id).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error('Error getting product:', error);
            return null;
        }
    },

    async addProduct(product) {
        try {
            product.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            product.sold = product.sold || 0;
            const docRef = await this.productsCollection.add(product);
            return { id: docRef.id, ...product };
        } catch (error) {
            console.error('Error adding product:', error);
            return null;
        }
    },

    async updateProduct(id, updates) {
        try {
            await this.productsCollection.doc(id).update(updates);
            return { id, ...updates };
        } catch (error) {
            console.error('Error updating product:', error);
            return null;
        }
    },

    async deleteProduct(id) {
        try {
            await this.productsCollection.doc(id).delete();
            return true;
        } catch (error) {
            console.error('Error deleting product:', error);
            return false;
        }
    },

    async getOrders() {
        // Admin function — reads ALL orders, ordered by date desc
        try {
            const snapshot = await this.ordersCollection
                .orderBy('createdAt', 'desc')
                .get();
            return snapshot.docs.map(doc => this._orderFromDoc(doc));
        } catch (error) {
            console.error('Error getting orders:', error);
            return [];
        }
    },

    async getOrder(id) {
        try {
            const doc = await this.ordersCollection.doc(id).get();
            return doc.exists ? this._orderFromDoc(doc) : null;
        } catch (error) {
            console.error('Error getting order:', error);
            return null;
        }
    },

    async getOrdersByCustomerEmail(email) {
        // Customer-facing — fetches only this customer's orders
        try {
            const snapshot = await db.collection('orders')
                .where('customer.email', '==', email)
                .orderBy('createdAt', 'desc')
                .get();
            return snapshot.docs.map(doc => this._orderFromDoc(doc));
        } catch (error) {
            console.error('Error getting customer orders:', error);
            throw error; // re-throw so caller can show index link
        }
    },

    async addOrder(order) {
        try {
            order.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            order.status = 'pending';

            const docRef = await this.ordersCollection.add(order);

            // Update sold count and stock for each item
            const batch = db.batch();
            for (const item of order.items) {
                const productRef = this.productsCollection.doc(item.productId);
                const productDoc = await productRef.get();
                if (productDoc.exists) {
                    const product = productDoc.data();
                    const qty = item.quantity || 1;
                    batch.update(productRef, {
                        sold:  (product.sold  || 0) + qty,
                        stock: (product.stock || 0) - qty
                    });
                }
            }
            await batch.commit();

            return { id: docRef.id, ...order };
        } catch (error) {
            console.error('Error adding order:', error);
            return null;
        }
    },

    async updateOrder(id, updates) {
        try {
            await this.ordersCollection.doc(id).update(updates);
            return { id, ...updates };
        } catch (error) {
            console.error('Error updating order:', error);
            return null;
        }
    },

    async deleteOrder(id) {
        try {
            await this.ordersCollection.doc(id).delete();
            return true;
        } catch (error) {
            console.error('Error deleting order:', error);
            return false;
        }
    },

    async getAnalytics() {
        try {
            const [orders, products] = await Promise.all([
                this.getOrders(),
                this.getProducts()
            ]);

            const activeOrders = orders.filter(o => o.status !== 'cancelled');
            const totalRevenue = activeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
            const totalOrders  = activeOrders.length;
            const avgOrder     = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            const topProducts = [...products]
                .sort((a, b) => (b.sold || 0) - (a.sold || 0))
                .slice(0, 5);

            return { totalRevenue, totalOrders, totalProducts: products.length, avgOrder, topProducts };
        } catch (error) {
            console.error('Error getting analytics:', error);
            return { totalRevenue: 0, totalOrders: 0, totalProducts: 0, avgOrder: 0, topProducts: [] };
        }
    }
};

DB.init();
