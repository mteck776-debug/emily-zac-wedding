// ── Firebase connection ─────────────────────────────────────────────
// Set to null to run in demo mode (RSVPs are only saved in the browser you
// are using). These values identify the project and are safe to publish;
// the Firestore rules protect the data.
export const firebaseConfig = {
  apiKey: "AIzaSyAR9oksO6GiPrvyi5i1BspEuC-jfxYFFHw",
  authDomain: "mily-zac-wedding.firebaseapp.com",
  projectId: "mily-zac-wedding",
  storageBucket: "mily-zac-wedding.firebasestorage.app",
  messagingSenderId: "278475932399",
  appId: "1:278475932399:web:20a44c31fa3dbb4f56111a",
};

// ── Settings that are not edited from the admin page ───────────────
// (Text, date, price, colours and photo are edited on admin.html.)
export const site = {
  maxGuestsPerRsvp: 12,
};
