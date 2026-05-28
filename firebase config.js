// firebase-config.js

// === Modular Imports (v9+) ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Your Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyBp1yaLCexKOglNcMh3-ppnGvV3pN_7ulY",
    authDomain: "lihim-clothing-2f635.firebaseapp.com",
    projectId: "lihim-clothing-2f635",
    storageBucket: "lihim-clothing-2f635.firebasestorage.app",
    messagingSenderId: "791415987673",
    appId: "1:791415987673:web:06af7ea1142ca47f738dc8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
const auth = getAuth(app);
const db = getFirestore(app);

// Admin Emails
const ADMIN_EMAILS = [
    'sendrijasmelchor@gmail.com',
    'lobetejohnryzel75@gmail.com'
];

// Cloudinary Config
const CLOUDINARY_CONFIG = {
    cloudName: "dtvyptdyf",
    uploadPreset: "lihim_products"
};

// Export everything
export { 
    db, 
    auth, 
    ADMIN_EMAILS, 
    CLOUDINARY_CONFIG 
};
