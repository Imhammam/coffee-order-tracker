importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCzdDxSKR8yqmUXyYCZyEiQJXVJI3Y_e60",
  authDomain: "coffee-order-tracker-4680e.firebaseapp.com",
  projectId: "coffee-order-tracker-4680e",
  storageBucket: "coffee-order-tracker-4680e.firebasestorage.app",
  messagingSenderId: "1046457474337",
  appId: "1:1046457474337:web:2c6589f012eb4747da3260"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});