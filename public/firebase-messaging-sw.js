importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCaSkIKcyhhYHzXR3_0nnyRiMhImr0TTfc",
  authDomain: "daily-tasks-8c693.firebaseapp.com",
  projectId: "daily-tasks-8c693",
  storageBucket: "daily-tasks-8c693.firebasestorage.app",
  messagingSenderId: "828627362719",
  appId: "1:828627362719:web:3e36ae819885b16f15d3aa",
  databaseURL: "https://daily-tasks-8c693-default-rtdb.firebaseio.com/"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = (payload && payload.notification && payload.notification.title) || 'Background Message';
  const options = {
    body: (payload && payload.notification && payload.notification.body) || '',
    icon: '/logo192.png'
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then(function(clientList) {
    if (clientList.length > 0) {
      return clientList[0].focus();
    }
    return clients.openWindow('/');
  }));
});
