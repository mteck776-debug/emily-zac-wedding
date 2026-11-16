import { site } from './config.js?v=6';
import * as store from './store.js?v=6';
import { defaults, merge, get, fill, venueTime, applyTheme } from './content.js?v=6';

const $ = (id) => document.getElementById(id);
const money = (n) => '$' + Number(n).toLocaleString('en-AU');
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

if (store.demo) $('demoBanner').hidden = false;

// ── content: text, colours and photo come from the Edit website tab ──
const cache = {
  get() { try { return JSON.parse(localStorage.getItem('wed_content_cache')); } catch { return null; } },
  set(v) { try { localStorage.setItem('wed_content_cache', JSON.stringify(v)); } catch { /* ignore */ } },
};
let content = merge(defaults, cache.get());
const t = (path) => fill(get(content, path), content);

function bind(root) {
  root.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
}

function renderLists() {
  const sched = $('scheduleList');
  sched.textContent = '';
  for (const it of content.schedule.items) {
    const li = el('li');
    li.append(el('time', null, fill(it.time, content)), el('h3', null, fill(it.title, content)));
    if (it.text) li.append(el('p', 'lines', fill(it.text, content)));
    if (it.note) li.append(el('p', 'fine lines', fill(it.note, content)));
    sched.append(li);
  }
  const stay = $('stayList');
  stay.textContent = '';
  for (const it of content.stay.items) {
    const card = el('article', 'card');
    card.append(el('h3', null, fill(it.title, content)));
    if (it.text) card.append(el('p', 'lines', fill(it.text, content)));
    if (it.url && /^https?:\/\//i.test(it.url)) {
      const a = el('a', 'link', fill(it.linkText || 'Open link', content));
      a.href = it.url; a.target = '_blank'; a.rel = 'noopener';
      card.append(a);
    }
    stay.append(card);
  }
  const faq = $('faqList');
  faq.textContent = '';
  content.faq.items.forEach((it, i) => {
    const d = el('details');
    d.open = i === 0;
    d.append(el('summary', null, fill(it.q, content)), el('p', 'lines', fill(it.a, content)));
    faq.append(d);
  });
}

let ceremonyAt = null;
function tick() {
  const box = $('countdown');
  const ms = ceremonyAt ? ceremonyAt.getTime() - Date.now() : -1;
  box.textContent = '';
  box.hidden = !content.showCountdown || ms <= 0;
  if (box.hidden) return;
  const parts = [
    [Math.floor(ms / 864e5), 'days'],
    [Math.floor(ms / 36e5) % 24, 'hours'],
    [Math.floor(ms / 6e4) % 60, 'minutes'],
  ];
  for (const [n, label] of parts) {
    const cell = el('div');
    cell.append(el('strong', null, n), el('span', null, label));
    box.append(cell);
  }
}
setInterval(tick, 30000);

function applyContent() {
  document.title = t('pageTitle');
  applyTheme(content.theme);
  bind(document);
  const mark = $('navMark');
  mark.textContent = '';
  mark.append((content.hero.name1.trim()[0] || '') + ' ', el('span', 'amp', '&'), ' ' + (content.hero.name2.trim()[0] || ''));
  for (const sec of ['where', 'schedule', 'stay', 'faq']) {
    document.querySelectorAll(`[data-sec="${sec}"]`).forEach((n) => { n.hidden = !content[sec].show; });
  }
  $('mapLink').href = 'https://www.google.com/maps/search/?api=1&query='
    + encodeURIComponent(content.where.title + ' ' + content.where.address);
  renderLists();
  ceremonyAt = venueTime(content.ceremony);
  tick();
  if ($('guests').children.length) refresh();
}

function applyHero(image) {
  if (image && image.startsWith('data:image/')) {
    document.documentElement.style.setProperty('--hero-img', `url("${image}")`);
  }
}

applyContent();
const reveal = () => document.body.classList.remove('loading');
setTimeout(reveal, 3000);
store.getContent().then(({ site: saved, hero }) => {
  content = merge(defaults, saved);
  cache.set(saved);
  applyContent();
  applyHero(hero);
}).catch((err) => console.error(err)).finally(reveal);

// ── guest rows ──────────────────────────────────────────────────────
const guestsBox = $('guests');
const tpl = $('guestTpl');
let rowId = 0;

function addGuest() {
  if (guestsBox.children.length >= site.maxGuestsPerRsvp) return;
  const row = tpl.content.firstElementChild.cloneNode(true);
  const name = 'attend' + (rowId++);
  row.querySelector('.g-yes').name = name;
  row.querySelector('.g-no').name = name;
  row.querySelector('.guest-remove').addEventListener('click', () => { row.remove(); refresh(); });
  row.addEventListener('change', refresh);
  bind(row);
  guestsBox.append(row);
  refresh();
  return row;
}

function readGuests() {
  return [...guestsBox.children].map((row) => {
    const attending = row.querySelector('.g-yes').checked;
    const eating = attending && row.querySelector('.g-eat').checked;
    return {
      name: row.querySelector('.g-name').value.trim(),
      answered: attending || row.querySelector('.g-no').checked,
      attending,
      eating,
      dietary: eating ? row.querySelector('.g-diet').value.trim() : '',
    };
  });
}

function refresh() {
  const rows = [...guestsBox.children];
  rows.forEach((row, i) => {
    row.querySelector('legend').textContent = rows.length > 1 ? 'Guest ' + (i + 1) : 'Your details';
    row.querySelector('.guest-remove').hidden = rows.length === 1;
    const yes = row.querySelector('.g-yes').checked;
    row.querySelector('.g-extra').hidden = !yes;
    row.querySelector('.g-diet-wrap').hidden = !row.querySelector('.g-eat').checked;
  });
  $('addGuest').hidden = rows.length >= site.maxGuestsPerRsvp;
  const eating = readGuests().filter((g) => g.eating).length;
  const total = $('total');
  total.hidden = eating === 0;
  total.textContent = `Meals: ${eating} × ${money(content.price)} = ${money(eating * content.price)}`;
}

$('addGuest').addEventListener('click', () => { const r = addGuest(); if (r) r.querySelector('.g-name').focus(); });
addGuest();

// ── payment details panel ───────────────────────────────────────────
function copyButton(text) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'copy';
  b.textContent = 'Copy';
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; }
    catch { b.textContent = 'Press and hold to copy'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 2000);
  });
  return b;
}

function showPayment(pay, eatingCount, reference) {
  const dl = $('payDetails');
  dl.textContent = '';
  const rows = [
    ['Account name', pay.accountName],
    ['BSB', pay.bsb],
    ['Account number', pay.accountNumber],
    ['PayID', pay.payId],
  ].filter(([, v]) => v);
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    const span = document.createElement('span');
    span.textContent = value;
    dd.append(span, copyButton(value));
    dl.append(dt, dd);
  }
  $('payAmount').textContent = eatingCount
    ? `Amount to pay: ${money(eatingCount * content.price)} (${eatingCount} × ${money(content.price)})`
    : `Meals are ${money(content.price)} per person.`;
  const ref = $('payRef');
  ref.textContent = '';
  ref.append(reference
    ? `Please put this in the payment description: ${reference}`
    : 'Please put the names of everyone you are paying for in the payment description.');
  if (pay.note) { ref.append(document.createElement('br'), pay.note); }
  $('payBox').hidden = rows.length === 0;
}

function showDone(title, text) {
  $('doneTitle').textContent = title;
  $('doneText').textContent = text;
  $('rsvpForm').hidden = true;
  const done = $('done');
  done.hidden = false;
  done.focus();
  done.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function fail(msg) {
  const e = $('formError');
  e.textContent = msg;
  e.hidden = false;
}

async function checkCode() {
  const pay = await store.getPayment(store.GUEST_CODE);
  if (!pay) { fail("RSVPs aren't open just yet. Please check back soon."); return null; }
  return { code: store.GUEST_CODE, pay };
}

// ── submit ──────────────────────────────────────────────────────────
$('rsvpForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('formError').hidden = true;
  const guests = readGuests();
  if (guests.some((g) => !g.name)) return fail('Please enter a name for every guest.');
  if (guests.some((g) => !g.answered)) return fail('Please choose accepts or declines for every guest.');

  const send = $('send');
  send.disabled = true;
  send.textContent = 'Sending…';
  try {
    const ok = await checkCode();
    if (!ok) return;
    await store.submitRsvp({
      code: ok.code,
      guests: guests.map(({ name, attending, eating, dietary }) => ({ name, attending, eating, dietary })),
      contact: $('contact').value.trim(),
      message: $('message').value.trim(),
    });
    const coming = guests.filter((g) => g.attending);
    const eating = guests.filter((g) => g.eating);
    if (!coming.length) {
      $('payBox').hidden = true;
      showDone(t('rsvp.sorryTitle'), t('rsvp.sorryText'));
    } else {
      if (eating.length) showPayment(ok.pay, eating.length, eating.map((g) => g.name).join(', '));
      else $('payBox').hidden = true;
      showDone(t('rsvp.thanksTitle'), eating.length ? t('rsvp.thanksPay') : t('rsvp.thanksNoPay'));
    }
  } catch (err) {
    console.error(err);
    fail('Sorry, something went wrong sending your RSVP. Please check your connection and try again.');
  } finally {
    send.disabled = false;
    send.textContent = t('rsvp.button');
  }
});

$('showPay').addEventListener('click', async () => {
  $('formError').hidden = true;
  try {
    const ok = await checkCode();
    if (!ok) return;
    showPayment(ok.pay, 0, '');
    showDone('Bank details', 'Use these details to pay for your meals.');
  } catch (err) {
    console.error(err);
    fail('Sorry, the bank details could not be loaded. Please try again.');
  }
});

$('again').addEventListener('click', () => {
  $('done').hidden = true;
  $('rsvpForm').hidden = false;
  $('rsvpForm').reset();
  guestsBox.textContent = '';
  addGuest();
  $('rsvp').scrollIntoView({ behavior: 'smooth' });
});
