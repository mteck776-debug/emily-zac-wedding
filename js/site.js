import { site } from './config.js?v=4';
import * as store from './store.js?v=4';

const $ = (id) => document.getElementById(id);
const money = (n) => '$' + n.toLocaleString('en-AU');

document.querySelectorAll('[data-price]').forEach((el) => { el.textContent = site.pricePerPerson; });
if (store.demo) $('demoBanner').hidden = false;

// ── countdown ───────────────────────────────────────────────────────
(function countdown() {
  const box = $('countdown');
  const target = new Date(site.ceremony).getTime();
  const tick = () => {
    const ms = target - Date.now();
    box.textContent = '';
    if (ms <= 0) { box.hidden = true; return; }
    const parts = [
      [Math.floor(ms / 864e5), 'days'],
      [Math.floor(ms / 36e5) % 24, 'hours'],
      [Math.floor(ms / 6e4) % 60, 'minutes'],
    ];
    for (const [n, label] of parts) {
      const cell = document.createElement('div');
      const num = document.createElement('strong');
      num.textContent = n;
      const lab = document.createElement('span');
      lab.textContent = label;
      cell.append(num, lab);
      box.append(cell);
    }
  };
  tick();
  setInterval(tick, 30000);
})();

// ── guest code: from the link (?code=XXXX) or remembered ────────────
const codeInput = $('code');
const remember = {
  get() { try { return localStorage.getItem('wed_code') || ''; } catch { return ''; } },
  set(v) { try { localStorage.setItem('wed_code', v); } catch { /* ignore */ } },
};
const urlCode = store.cleanCode(new URLSearchParams(location.search).get('code'));
codeInput.value = urlCode || remember.get() || (store.demo ? 'DEMO' : '');
if (codeInput.value) codeInput.closest('.field').classList.add('prefilled');

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
  total.textContent = `Meals: ${eating} × ${money(site.pricePerPerson)} = ${money(eating * site.pricePerPerson)}`;
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
    ? `Amount to pay: ${money(eatingCount * site.pricePerPerson)} (${eatingCount} × ${money(site.pricePerPerson)})`
    : `Meals are ${money(site.pricePerPerson)} per person.`;
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
  const code = store.cleanCode(codeInput.value);
  if (!code) { fail('Please enter the guest code from your invitation.'); codeInput.focus(); return null; }
  const pay = await store.getPayment(code);
  if (!pay) { fail("That guest code isn't recognised. Please check your invitation."); codeInput.focus(); return null; }
  remember.set(code);
  return { code, pay };
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
      showDone('Thank you for letting us know', "We're sorry you can't make it and we'll miss you on the day.");
    } else {
      if (eating.length) showPayment(ok.pay, eating.length, eating.map((g) => g.name).join(', '));
      else $('payBox').hidden = true;
      showDone("You're on the list!", eating.length
        ? 'Thank you for your RSVP. To confirm your meals, please transfer the amount below.'
        : 'Thank you for your RSVP. We can’t wait to see you there.');
    }
  } catch (err) {
    console.error(err);
    fail('Sorry, something went wrong sending your RSVP. Please check your connection and try again.');
  } finally {
    send.disabled = false;
    send.textContent = 'Send RSVP';
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
  codeInput.value = remember.get();
  guestsBox.textContent = '';
  addGuest();
  $('rsvp').scrollIntoView({ behavior: 'smooth' });
});
