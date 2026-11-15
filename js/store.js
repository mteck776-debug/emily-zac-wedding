// Data layer. Uses Firebase when js/config.js has a config, otherwise a
// browser-only demo store so the site can be previewed before setup.
import { firebaseConfig } from './config.js?v=5';

export const demo = !firebaseConfig;
const CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';
let fb;

async function load() {
  if (fb) return fb;
  const [app, fs, auth] = await Promise.all([
    import(CDN + 'firebase-app.js'),
    import(CDN + 'firebase-firestore.js'),
    import(CDN + 'firebase-auth.js'),
  ]);
  const a = app.initializeApp(firebaseConfig);
  fb = { fs, auth, db: fs.getFirestore(a), au: auth.getAuth(a) };
  return fb;
}

// Guests no longer type a code; every RSVP uses this fixed one so the
// database rules stay the same.
export const GUEST_CODE = 'GUEST';
export const cleanCode = (s) => String(s || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

// ── demo store ──────────────────────────────────────────────────────
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const demoPayment = () => LS.get('wed_payment', {
  code: 'DEMO', accountName: 'Example Name', bsb: '000-000', accountNumber: '00000000', payId: '', note: '',
});
const watchers = new Set();
const demoRsvps = () => LS.get('wed_rsvps', []).map((r) => ({ ...r, createdAt: r.createdAt ? new Date(r.createdAt) : null }));
const demoNotify = () => watchers.forEach((cb) => cb(demoRsvps()));
const demoMutate = (fn) => { LS.set('wed_rsvps', fn(LS.get('wed_rsvps', []))); demoNotify(); };

// ── guest side ──────────────────────────────────────────────────────
/** Payment details for a guest code, or null if the code is not recognised. */
export async function getPayment(code) {
  code = cleanCode(code);
  if (!code) return null;
  if (demo) { const { code: _c, ...rest } = demoPayment(); return rest; }
  const { fs, db } = await load();
  const snap = await fs.getDoc(fs.doc(db, 'payment', code));
  return snap.exists() ? snap.data() : null;
}

export async function submitRsvp({ code, guests, contact, message }) {
  const data = { code: cleanCode(code), guests, contact, message, paid: false };
  if (demo) {
    demoMutate((all) => [{ id: 'd' + Date.now(), ...data, createdAt: new Date().toISOString() }, ...all]);
    return;
  }
  const { fs, db } = await load();
  await fs.addDoc(fs.collection(db, 'rsvps'), { ...data, createdAt: fs.serverTimestamp() });
}

// ── admin side ──────────────────────────────────────────────────────
/** cb(state) where state is 'out' | 'denied' | 'admin'. */
export async function onAuth(cb) {
  if (demo) { cb('admin'); return; }
  const { fs, auth, db, au } = await load();
  auth.onAuthStateChanged(au, async (user) => {
    if (!user) return cb('out');
    try {
      const snap = await fs.getDoc(fs.doc(db, 'admins', user.uid));
      cb(snap.exists() ? 'admin' : 'denied', user);
    } catch { cb('denied', user); }
  });
}
export async function signIn(email, password) {
  const { auth, au } = await load();
  await auth.signInWithEmailAndPassword(au, email, password);
}
export async function signOut() {
  if (demo) return;
  const { auth, au } = await load();
  await auth.signOut(au);
}

export async function watchRsvps(cb, onError) {
  if (demo) { watchers.add(cb); cb(demoRsvps()); return; }
  const { fs, db } = await load();
  fs.onSnapshot(
    fs.query(fs.collection(db, 'rsvps'), fs.orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => {
      const v = d.data();
      return { id: d.id, ...v, createdAt: v.createdAt && v.createdAt.toDate ? v.createdAt.toDate() : null };
    })),
    onError,
  );
}
export async function updateRsvp(id, patch) {
  if (demo) return demoMutate((all) => all.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const { fs, db } = await load();
  await fs.updateDoc(fs.doc(db, 'rsvps', id), patch);
}
export async function deleteRsvp(id) {
  if (demo) return demoMutate((all) => all.filter((r) => r.id !== id));
  const { fs, db } = await load();
  await fs.deleteDoc(fs.doc(db, 'rsvps', id));
}

/** Current guest code + payment details, or null when none saved yet. */
export async function loadPayment() {
  if (demo) return demoPayment();
  const { fs, db } = await load();
  const snap = await fs.getDocs(fs.collection(db, 'payment'));
  if (snap.empty) return null;
  const d = snap.docs.find((x) => x.id === GUEST_CODE) || snap.docs[0];
  return { code: d.id, ...d.data() };
}
export async function savePayment(code, details, oldCode) {
  code = cleanCode(code);
  if (demo) return LS.set('wed_payment', { code, ...details });
  const { fs, db } = await load();
  await fs.setDoc(fs.doc(db, 'payment', code), details);
  if (oldCode && oldCode !== code) await fs.deleteDoc(fs.doc(db, 'payment', oldCode));
}
