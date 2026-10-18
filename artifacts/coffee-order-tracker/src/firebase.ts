import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCzdDxSKR8yqmUXyYCZyEiQJXVJI3Y_e60",
  authDomain: "coffee-order-tracker-4680e.firebaseapp.com",
  projectId: "coffee-order-tracker-4680e",
  storageBucket: "coffee-order-tracker-4680e.firebasestorage.app",
  messagingSenderId: "1046457474337",
  appId: "1:1046457474337:web:2c6589f012eb4747da3260"
};

// تهيئة الفايربيس
const app = initializeApp(firebaseConfig);

// تهيئة خدمة الـ Messaging للإشعارات
export const messaging = typeof window !== "undefined" ? getMessaging(app) : null;