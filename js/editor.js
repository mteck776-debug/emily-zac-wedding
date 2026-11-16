// "Edit website" tab: plain form fields for everything guests see.
import { defaults, merge, get, set } from './content.js?v=6';

// What can be edited. [path, label, type, hint]
// types: text (default), long, number, when, colour, toggle
const GROUPS = [
  { title: 'Top of the page', fields: [
    ['hero.name1', 'First name'],
    ['hero.name2', 'Second name'],
    ['hero.eyebrow', 'Small line above the names'],
    ['hero.date', 'Date line'],
    ['hero.place', 'Place line'],
    ['hero.button', 'Button text'],
    ['footer.date', 'Date at the very bottom of the page'],
    ['pageTitle', 'Name shown on the browser tab'],
  ] },
  { title: 'Date, countdown and meal price', fields: [
    ['ceremony', 'Ceremony date and time', 'when', 'Tasmanian time. The countdown counts down to this.'],
    ['showCountdown', 'Show the countdown', 'toggle'],
    ['price', 'Meal price per person ($)', 'number', 'Type {price} in any text and it shows this number.'],
  ] },
  { title: 'Where', show: 'where.show', fields: [
    ['where.nav', 'Menu name'],
    ['where.eyebrow', 'Small heading'],
    ['where.title', 'Venue name'],
    ['where.text', 'Text', 'long'],
    ['where.address', 'Address', 'text', 'The map button uses the venue name and this address.'],
    ['where.button', 'Map button text'],
  ] },
  { title: 'Schedule', show: 'schedule.show', fields: [
    ['schedule.nav', 'Menu name'],
    ['schedule.eyebrow', 'Small heading'],
    ['schedule.title', 'Heading'],
  ], list: { path: 'schedule.items', item: 'event', blank: { time: '', title: '', text: '', note: '' }, fields: [
    ['time', 'Time'], ['title', 'Title'], ['text', 'Description', 'long'], ['note', 'Small note (optional)'],
  ] } },
  { title: 'Where to stay', show: 'stay.show', fields: [
    ['stay.nav', 'Menu name'],
    ['stay.eyebrow', 'Small heading'],
    ['stay.title', 'Heading'],
  ], list: { path: 'stay.items', item: 'option', blank: { title: '', text: '', linkText: '', url: '' }, fields: [
    ['title', 'Title'], ['text', 'Description', 'long'], ['linkText', 'Link text'], ['url', 'Link address', 'text', 'Starts with https://'],
  ] } },
  { title: 'Questions and answers', show: 'faq.show', fields: [
    ['faq.nav', 'Menu name'],
    ['faq.eyebrow', 'Small heading'],
    ['faq.title', 'Heading'],
  ], list: { path: 'faq.items', item: 'question', blank: { q: '', a: '' }, fields: [
    ['q', 'Question'], ['a', 'Answer', 'long'],
  ] } },
  { title: 'RSVP form and thank-you messages', fields: [
    ['rsvp.nav', 'Menu name'],
    ['rsvp.eyebrow', 'Small heading'],
    ['rsvp.title', 'Heading'],
    ['rsvp.accept', 'Wording for "yes"'],
    ['rsvp.decline', 'Wording for "no"'],
    ['rsvp.food', 'Food tick box wording'],
    ['rsvp.button', 'Send button text'],
    ['rsvp.thanksTitle', 'Thank-you heading'],
    ['rsvp.thanksPay', 'Thank-you message when there are meals to pay for', 'long'],
    ['rsvp.thanksNoPay', 'Thank-you message when there is nothing to pay', 'long'],
    ['rsvp.sorryTitle', 'Heading when nobody in the reply can come'],
    ['rsvp.sorryText', 'Message when nobody in the reply can come', 'long'],
  ] },
  { title: 'Colours', fields: [
    ['theme.primary', 'Main colour (buttons, headings, top of page)', 'colour'],
    ['theme.accent', 'Accent colour (the "&", timeline)', 'colour'],
    ['theme.background', 'Page background', 'colour'],
    ['theme.tint', 'Background of every second section', 'colour'],
  ], resetTheme: true },
];

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
let uid = 0;

/** Shrink a chosen photo so it is quick to load and fits in the database. */
async function shrinkPhoto(file) {
  const bitmap = await createImageBitmap(file);
  let side = 1800;
  let quality = 0.84;
  for (let i = 0; i < 6; i++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length < 900000) return url;
    side = Math.round(side * 0.8);
    quality -= 0.06;
  }
  throw new Error('too large');
}

export function mountEditor(root, store, { onSaved } = {}) {
  let content = merge(defaults, null);
  let hero;                 // undefined = unchanged, null = removed, string = new photo
  let savedHero = null;
  const bar = el('div', 'savebar');
  const status = el('span', 'savebar-status', 'No changes yet');
  const saveBtn = el('button', 'btn btn-solid btn-small', 'Save changes');
  saveBtn.type = 'button';
  const view = el('a', 'textbtn', 'View guest site');
  view.href = 'index.html';
  view.target = '_blank';
  view.rel = 'noopener';
  bar.append(status, view, saveBtn);

  const dirty = () => { status.textContent = 'Unsaved changes'; bar.classList.add('dirty'); };

  function field(target, key, label, type = 'text', hint, read = () => get(target, key), write = (v) => set(target, key, v)) {
    const id = 'ed' + (uid++);
    if (type === 'toggle') {
      const wrap = el('label', 'check');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = !!read();
      box.addEventListener('change', () => { write(box.checked); dirty(); });
      wrap.append(box, el('span', null, label));
      return wrap;
    }
    const wrap = el('label', 'field');
    wrap.htmlFor = id;
    wrap.append(el('span', null, label));
    let input;
    if (type === 'long') { input = el('textarea'); input.rows = 3; }
    else {
      input = el('input');
      input.type = { number: 'number', when: 'datetime-local', colour: 'color' }[type] || 'text';
      if (type === 'number') { input.min = 0; input.step = 1; input.inputMode = 'numeric'; }
    }
    input.id = id;
    input.value = read() ?? '';
    input.addEventListener('input', () => {
      if (type === 'number') write(Math.max(0, Number(input.value) || 0));
      else if (type === 'when') { if (input.value) write(input.value.slice(0, 16)); }
      else write(input.value);
      dirty();
    });
    wrap.append(input);
    if (hint) wrap.append(el('small', null, hint));
    return wrap;
  }

  function listEditor(spec) {
    const box = el('div', 'ed-list');
    const draw = () => {
      const items = get(content, spec.path);
      box.textContent = '';
      items.forEach((item, i) => {
        const card = el('div', 'ed-item');
        const head = el('div', 'ed-item-head');
        head.append(el('strong', null, `${spec.item[0].toUpperCase()}${spec.item.slice(1)} ${i + 1}`));
        const tools = el('div', 'ed-tools');
        const tool = (text, label, off, act) => {
          const b = el('button', 'chip', text);
          b.type = 'button';
          b.setAttribute('aria-label', `${label} ${spec.item} ${i + 1}`);
          b.disabled = off;
          b.addEventListener('click', () => { act(); dirty(); draw(); });
          tools.append(b);
        };
        tool('↑', 'Move up', i === 0, () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; });
        tool('↓', 'Move down', i === items.length - 1, () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; });
        tool('Remove', 'Remove', false, () => { items.splice(i, 1); });
        head.append(tools);
        card.append(head);
        for (const [key, label, type, hint] of spec.fields) {
          card.append(field(item, key, label, type, hint, () => item[key], (v) => { item[key] = v; }));
        }
        box.append(card);
      });
      const add = el('button', 'btn btn-outline btn-small', `+ Add ${spec.item}`);
      add.type = 'button';
      add.addEventListener('click', () => {
        items.push({ ...spec.blank });
        dirty();
        draw();
        const cards = box.querySelectorAll('.ed-item');
        cards[cards.length - 1].querySelector('input, textarea').focus();
      });
      box.append(add);
    };
    draw();
    return box;
  }

  function photoGroup() {
    const sec = el('details', 'ed-group');
    sec.append(el('summary', null, 'Main photo'));
    const body = el('div', 'ed-body');
    const preview = el('img', 'ed-photo');
    preview.alt = 'Main photo preview';
    const show = () => { preview.src = (hero === undefined ? savedHero : hero) || 'images/hero.jpg'; };
    show();
    const msg = el('p', 'muted');
    const pick = el('input');
    pick.type = 'file';
    pick.accept = 'image/*';
    pick.id = 'edPhoto';
    const lab = el('label', 'field');
    lab.htmlFor = pick.id;
    lab.append(el('span', null, 'Choose a new photo'), pick,
      el('small', null, 'Faces near the top-middle of the photo work best. It is resized for you.'));
    pick.addEventListener('change', async () => {
      if (!pick.files[0]) return;
      msg.textContent = 'Preparing photo…';
      try {
        hero = await shrinkPhoto(pick.files[0]);
        msg.textContent = 'New photo ready. Press "Save changes" to put it on the site.';
        show();
        dirty();
      } catch (err) {
        console.error(err);
        msg.textContent = 'That photo could not be used. Try a JPG or PNG.';
      }
    });
    const reset = el('button', 'textbtn', 'Go back to the original photo');
    reset.type = 'button';
    reset.addEventListener('click', () => { hero = null; pick.value = ''; show(); dirty(); msg.textContent = 'Press "Save changes" to apply.'; });
    body.append(preview, lab, msg, reset);
    sec.append(body);
    return sec;
  }

  function draw() {
    root.textContent = '';
    root.append(el('p', 'muted', 'Open a section, change what you like, then press "Save changes". Guests see the new version the next time they open the site.'));
    root.append(photoGroup());
    for (const g of GROUPS) {
      const sec = el('details', 'ed-group');
      sec.append(el('summary', null, g.title));
      const body = el('div', 'ed-body');
      if (g.show) body.append(field(content, g.show, 'Show this section on the site', 'toggle'));
      for (const [path, label, type, hint] of g.fields) body.append(field(content, path, label, type, hint));
      if (g.list) body.append(listEditor(g.list));
      if (g.resetTheme) {
        const r = el('button', 'textbtn', 'Go back to the original colours');
        r.type = 'button';
        r.addEventListener('click', () => { content.theme = { ...defaults.theme }; dirty(); draw(); root.querySelectorAll('.ed-group')[GROUPS.indexOf(g) + 1].open = true; });
        body.append(r);
      }
      sec.append(body);
      root.append(sec);
    }
    root.append(bar);
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    status.textContent = 'Saving…';
    try {
      await store.saveContent(content);
      if (hero !== undefined) { await store.saveHero(hero); savedHero = hero; hero = undefined; }
      status.textContent = 'Saved. The site is updated.';
      bar.classList.remove('dirty');
      if (onSaved) onSaved(content);
    } catch (err) {
      console.error(err);
      status.textContent = 'Could not save. Check your internet connection and try again.';
    }
    saveBtn.disabled = false;
  });

  draw();
  root.querySelector('.ed-group').open = true;
  return {
    /** Fill the editor from what is saved. */
    load({ site, hero: savedImage }) {
      content = merge(defaults, site);
      savedHero = savedImage || null;
      draw();
      root.querySelector('.ed-group').open = true;
      return content;
    },
  };
}
