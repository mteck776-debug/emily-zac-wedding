import * as store from './store.js?v=7';
import { defaults } from './content.js?v=7';
import { mountEditor } from './editor.js?v=7';
import { mountInvites } from './invites.js?v=7';

const $ = (id) => document.getElementById(id);
const money = (n) => '$' + n.toLocaleString('en-AU');
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

if (store.demo) $('demoBanner').hidden = false;

let rsvps = [];
let filter = 'all';
let watching = false;
let price = defaults.price;
const invites = mountInvites($('viewInvites'), store);
const editor = mountEditor($('viewEdit'), store, {
  onSaved(content) { price = content.price; render(); },
});


const counts = (r) => {
  const guests = r.guests || [];
  const attending = guests.filter((g) => g.attending).length;
  const eating = guests.filter((g) => g.eating).length;
  return { attending, eating, owed: eating * price };
};

// ── auth ────────────────────────────────────────────────────────────
function show(view) {
  $('loading').hidden = true;
  $('login').hidden = view !== 'out';
  $('denied').hidden = view !== 'denied';
  $('dash').hidden = view !== 'admin';
  $('signOut').hidden = store.demo || view === 'out';
}

store.onAuth((state) => {
  show(state);
  if (state === 'admin' && !watching) {
    watching = true;
    store.watchRsvps((rows) => { rsvps = rows; render(); invites.setRsvps(rows); }, (err) => {
      console.error(err);
      $('listError').textContent = 'Could not load the RSVPs. Refresh the page to try again.';
      $('listError').hidden = false;
    });
    loadSettings();
    loadEditor();
    invites.load();
  }
}).catch((err) => {
  console.error(err);
  $('loading').textContent = 'Could not connect. Check your internet connection and refresh.';
});

$('login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('loginError').hidden = true;
  try {
    await store.signIn($('email').value.trim(), $('password').value);
  } catch (err) {
    console.error(err);
    $('loginError').textContent = 'That email or password is not right.';
    $('loginError').hidden = false;
  }
});
$('signOut').addEventListener('click', () => store.signOut());

// ── list ────────────────────────────────────────────────────────────
function visible() {
  const q = $('search').value.trim().toLowerCase();
  return rsvps.filter((r) => {
    const c = counts(r);
    if (filter === 'unpaid' && !(c.owed > 0 && !r.paid)) return false;
    if (filter === 'paid' && !r.paid) return false;
    if (filter === 'declined' && c.attending > 0) return false;
    if (q && !(r.guests || []).some((g) => (g.name || '').toLowerCase().includes(q))) return false;
    return true;
  });
}

function renderStats() {
  let attending = 0, declined = 0, eating = 0, owed = 0, paid = 0;
  for (const r of rsvps) {
    const c = counts(r);
    attending += c.attending;
    declined += (r.guests || []).length - c.attending;
    eating += c.eating;
    owed += c.owed;
    if (r.paid) paid += c.owed;
  }
  const items = [
    ['Replies', rsvps.length],
    ['Attending', attending],
    ['Declined', declined],
    ['Eating', eating],
    ['Paid', money(paid)],
    ['Outstanding', money(owed - paid)],
  ];
  const box = $('stats');
  box.textContent = '';
  for (const [label, value] of items) {
    const card = el('div', 'stat');
    card.append(el('strong', null, value), el('span', null, label));
    box.append(card);
  }
}

function card(r) {
  const c = counts(r);
  const node = el('article', 'rsvp' + (r.paid ? ' is-paid' : ''));

  const head = el('div', 'rsvp-head');
  const title = el('h3', null, (r.guests || []).map((g) => g.name).join(', ') || 'No names');
  const when = el('span', 'muted', r.createdAt
    ? r.createdAt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : '');
  head.append(title, when);
  node.append(head);

  const list = el('ul', 'rsvp-guests');
  for (const g of r.guests || []) {
    const li = el('li');
    li.append(el('span', 'g-name-text', g.name));
    li.append(el('span', 'tag ' + (g.attending ? 'yes' : 'no'), g.attending ? 'Attending' : 'Declined'));
    if (g.attending) li.append(el('span', 'tag ' + (g.eating ? 'eat' : 'plain'), g.eating ? 'Eating' : 'Not eating'));
    if (g.dietary) li.append(el('span', 'tag diet', g.dietary));
    list.append(li);
  }
  node.append(list);

  if (r.contact) node.append(el('p', 'rsvp-meta', 'Contact: ' + r.contact));
  if (r.message) node.append(el('p', 'rsvp-meta quote', r.message));

  const foot = el('div', 'rsvp-foot');
  if (c.owed > 0) {
    const label = el('label', 'paid-toggle');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = !!r.paid;
    box.addEventListener('change', async () => {
      box.disabled = true;
      try { await store.updateRsvp(r.id, { paid: box.checked, paidAt: box.checked ? new Date().toISOString() : null }); }
      catch (err) { console.error(err); box.checked = !box.checked; }
      box.disabled = false;
    });
    label.append(box, el('span', null, `Paid ${money(c.owed)}`));
    foot.append(label);
  } else {
    foot.append(el('span', 'muted', 'Nothing to pay'));
  }

  const del = el('button', 'textbtn danger', 'Delete');
  del.type = 'button';
  let armed = false;
  del.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      del.textContent = 'Tap again to delete';
      setTimeout(() => { armed = false; del.textContent = 'Delete'; }, 4000);
      return;
    }
    del.disabled = true;
    try { await store.deleteRsvp(r.id); } catch (err) { console.error(err); del.disabled = false; }
  });
  foot.append(del);
  node.append(foot);
  return node;
}

function render() {
  renderStats();
  const rows = visible();
  const list = $('list');
  list.textContent = '';
  rows.forEach((r) => list.append(card(r)));
  $('empty').hidden = rows.length > 0;
  $('empty').textContent = rsvps.length ? 'Nothing matches that filter.' : 'No RSVPs yet.';
}

$('search').addEventListener('input', render);
document.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
  filter = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('on', x === b));
  render();
}));

// ── export ──────────────────────────────────────────────────────────
$('export').addEventListener('click', () => {
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s;           // stop spreadsheet formulas
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const lines = [['Name', 'Attending', 'Eating', 'Dietary', 'Party', 'Party owes', 'Paid', 'Contact', 'Message', 'Replied']];
  for (const r of rsvps) {
    const c = counts(r);
    const party = (r.guests || []).map((g) => g.name).join(' & ');
    for (const g of r.guests || []) {
      lines.push([
        g.name, g.attending ? 'Yes' : 'No', g.eating ? 'Yes' : 'No', g.dietary || '',
        party, c.owed, r.paid ? 'Yes' : 'No', r.contact || '', r.message || '',
        r.createdAt ? r.createdAt.toLocaleDateString('en-AU') : '',
      ]);
    }
  }
  const csv = '﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'wedding-rsvps.csv';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// ── settings ────────────────────────────────────────────────────────
let savedCode = '';

function showShare() {
  $('shareLink').textContent = new URL('index.html', location.href).href.replace(/index\.html$/, '');
  $('share').hidden = false;
}

async function loadSettings() {
  try {
    const p = await store.loadPayment();
    if (!p) { $('settingsMsg').textContent = 'Not set up yet. Guests cannot RSVP until you save the bank details.'; return; }
    savedCode = p.code;
    $('sName').value = p.accountName || '';
    $('sBsb').value = p.bsb || '';
    $('sAcc').value = p.accountNumber || '';
    $('sPayId').value = p.payId || '';
    $('sNote').value = p.note || '';
    showShare();
  } catch (err) {
    console.error(err);
    $('settingsMsg').textContent = 'Could not load the saved details.';
  }
}

$('settings').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const code = store.GUEST_CODE;
  $('settingsMsg').textContent = 'Saving…';
  try {
    await store.savePayment(code, {
      accountName: $('sName').value.trim(),
      bsb: $('sBsb').value.trim(),
      accountNumber: $('sAcc').value.trim(),
      payId: $('sPayId').value.trim(),
      note: $('sNote').value.trim(),
    }, savedCode);
    savedCode = code;
    $('settingsMsg').textContent = 'Saved.';
    showShare();
  } catch (err) {
    console.error(err);
    $('settingsMsg').textContent = 'Could not save. Please try again.';
  }
});

$('copyLink').addEventListener('click', async () => {
  const b = $('copyLink');
  try { await navigator.clipboard.writeText($('shareLink').textContent); b.textContent = 'Copied'; }
  catch { b.textContent = 'Select the link to copy'; }
  setTimeout(() => { b.textContent = 'Copy'; }, 2000);
});

// ── tabs + website editor ───────────────────────────────────────────
const TABS = { Guests: 'RSVPs', Invites: 'Invite list', Edit: 'Edit website' };
function showTab(name) {
  for (const key of Object.keys(TABS)) {
    const on = key === name;
    $('view' + key).hidden = !on;
    $('tab' + key).classList.toggle('on', on);
    $('tab' + key).setAttribute('aria-selected', on);
  }
  $('adminTitle').textContent = TABS[name];
}
for (const key of Object.keys(TABS)) $('tab' + key).addEventListener('click', () => showTab(key));

async function loadEditor() {
  try {
    const content = editor.load(await store.getContent());
    price = content.price;
    render();
  } catch (err) {
    console.error(err);
  }
}
