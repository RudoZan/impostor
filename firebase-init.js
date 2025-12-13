// Firebase initialization placeholder.
// Replace the firebaseConfig object with your project's config from Firebase console.
// This file uses the compat SDK loaded from CDN in the HTML files.

/* Example firebaseConfig (replace values):
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};
*/

(function() {
  try {
    // If the user hasn't provided a config, skip initialization and leave `db` undefined.
    if (typeof firebase === 'undefined') {
      console.warn('Firebase SDK not loaded. Firestore integration disabled.');
      return;
    }

    // If firebaseConfig is defined elsewhere (user can paste above), use it.
    if (typeof firebaseConfig === 'undefined') {
      // No config provided — keep Firestore disabled but don't throw.
      console.warn('No firebaseConfig found in firebase-init.js. Firestore disabled until you add your config.');
      return;
    }

    // Initialize Firebase and expose Firestore as window.db
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    console.log('Firebase initialized. Firestore available as window.db');
  } catch (e) {
    console.error('Error initializing Firebase:', e);
  }
})();
