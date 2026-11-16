// "Invite list" tab: the names she invited, matched against the RSVPs.
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const LABEL = { yes: 'Attending', no: 'Declined', none: 'No reply' };

export function mountInvites(root, store) {
  let people = [];          // [{ id, name, manual }]  manual: '' | 'yes' | 'no'
  let rsvps = [];
  let filter = 'all';
  let loaded = false;

  const stats = el('section', 'stats');
  const msg = el('p', 'muted');
  msg.setAttribute('role', 'status');

  const addBox = el('form', 'panel invite-add');
  addBox.append(el('h2', null, 'Add people you invited'));
  const lab = el('label', 'field');
  lab.htmlFor = 'invNames';
  const area = el('textarea');
  area.id = 'invNames';
  area.rows = 4;
  area.placeholder = 'Sam Taylor\nAlex Taylor';
  lab.append(el('span', null, 'Names, one per line'), area,
    el('small', null, 'You can paste a whole list. Use the same full names guests will type when they RSVP.'));
  const addBtn = el('button', 'btn btn-solid btn-small', 'Add to list');
  addBtn.type = 'submit';
  addBox.append(lab, addBtn);

  const toolbar = el('section', 'toolbar');
  const search = el('input');
  search.type = 'search';
  search.placeholder = 'Search names';
  search.setAttribute('aria-label', 'Search invited names');
  const chips = el('div', 'filters');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', 'Filter');
  for (const [key, text] of [['all', 'All'], ['none', 'No reply'], ['yes', 'Attending'], ['no', 'Declined']]) {
    const b = el('button', 'chip' + (key === 'all' ? ' on' : ''), text);
    b.type = 'button';
    b.addEventListener('click', () => {
      filter = key;
      chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b));
      draw();
    });
    chips.append(b);
  }
  const exportBtn = el('button', 'btn btn-outline btn-small', 'Export spreadsheet');
  exportBtn.type = 'button';
  toolbar.append(search, chips, exportBtn);

  const list = el('div', 'invite-list');
  const empty = el('p', 'center muted');
  const extraBox = el('section', 'panel');
  root.append(stats, addBox, msg, toolbar, empty, list, extraBox);

  /** name → { attending, eating } from the newest RSVP that mentions it */
  function replies() {
    const map = new Map();
    for (const r of rsvps) {
      for (const g of r.guests || []) {
        const key = norm(g.name);
        if (key && !map.has(key)) map.set(key, g);
      }
    }
    return map;
  }
  function statusOf(person, map) {
    if (person.manual) return { status: person.manual, source: 'Set by you' };
    const g = map.get(norm(person.name));
    if (!g) return { status: 'none', source: '' };
    return { status: g.attending ? 'yes' : 'no', source: 'From their RSVP' };
  }

  async function save() {
    msg.textContent = 'Saving…';
    try {
      await store.saveInvites(people);
      msg.textContent = 'Saved.';
    } catch (err) {
      console.error(err);
      msg.textContent = 'Could not save the invite list. Check your connection and try again.';
    }
  }

  function draw() {
    const map = replies();
    const rows = people.map((p) => ({ p, ...statusOf(p, map) }));
    const count = (s) => rows.filter((r) => r.status === s).length;

    stats.textContent = '';
    for (const [label, value] of [['Invited', rows.length], ['Attending', count('yes')], ['Declined', count('no')], ['No reply', count('none')]]) {
      const card = el('div', 'stat');
      card.append(el('strong', null, value), el('span', null, label));
      stats.append(card);
    }

    const q = norm(search.value);
    const shown = rows
      .filter((r) => (filter === 'all' || r.status === filter) && (!q || norm(r.p.name).includes(q)))
      .sort((a, b) => a.p.name.localeCompare(b.p.name));
    list.textContent = '';
    for (const { p, status, source } of shown) {
      const row = el('div', 'invite');
      const main = el('div', 'invite-main');
      main.append(el('span', 'g-name-text', p.name), el('span', 'tag ' + (status === 'none' ? 'plain' : status), LABEL[status]));
      if (source) main.append(el('span', 'muted invite-src', source));
      const tools = el('div', 'invite-tools');
      const sel = el('select');
      sel.setAttribute('aria-label', `Status for ${p.name}`);
      for (const [v, t] of [['', 'Use their RSVP'], ['yes', 'Mark attending'], ['no', 'Mark declined']]) {
        const o = el('option', null, t);
        o.value = v;
        sel.append(o);
      }
      sel.value = p.manual || '';
      sel.addEventListener('change', () => { p.manual = sel.value; draw(); save(); });
      const del = el('button', 'textbtn danger', 'Remove');
      del.type = 'button';
      del.setAttribute('aria-label', `Remove ${p.name}`);
      let armed = false;
      del.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          del.textContent = 'Tap again';
          setTimeout(() => { armed = false; del.textContent = 'Remove'; }, 4000);
          return;
        }
        people = people.filter((x) => x !== p);
        draw();
        save();
      });
      tools.append(sel, del);
      row.append(main, tools);
      list.append(row);
    }
    empty.hidden = shown.length > 0;
    empty.textContent = !loaded ? 'Loading…' : people.length ? 'Nobody matches that filter.' : 'No names yet. Add the people you invited above.';

    // people who replied but are not on the list
    const invited = new Set(people.map((p) => norm(p.name)));
    const extras = [...map.entries()].filter(([key]) => !invited.has(key)).map(([, g]) => g);
    extraBox.hidden = extras.length === 0;
    extraBox.textContent = '';
    if (extras.length) {
      extraBox.append(el('h2', null, 'Replied but not on your list'),
        el('p', 'muted', 'Plus-ones, or names typed differently from your list. If it is the same person under another spelling, fix the name on your list instead.'));
      for (const g of extras) {
        const row = el('div', 'invite');
        const main = el('div', 'invite-main');
        main.append(el('span', 'g-name-text', g.name), el('span', 'tag ' + (g.attending ? 'yes' : 'no'), g.attending ? 'Attending' : 'Declined'));
        const add = el('button', 'btn btn-outline btn-small', 'Add to list');
        add.type = 'button';
        add.setAttribute('aria-label', `Add ${g.name} to the invite list`);
        add.addEventListener('click', () => { addNames([g.name]); });
        row.append(main, add);
        extraBox.append(row);
      }
    }
  }

  function addNames(names) {
    const have = new Set(people.map((p) => norm(p.name)));
    let added = 0;
    for (const raw of names) {
      const name = raw.replace(/\s+/g, ' ').trim().slice(0, 80);
      const key = norm(name);
      if (!key || have.has(key)) continue;
      have.add(key);
      people.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name, manual: '' });
      added++;
    }
    draw();
    if (added) save();
    return added;
  }

  addBox.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const names = area.value.split(/[\n,;]+/);
    const typed = names.filter((n) => n.trim()).length;
    const added = addNames(names);
    area.value = '';
    if (!added) msg.textContent = typed ? 'Those names are already on the list.' : 'Type at least one name first.';
    else if (added < typed) msg.textContent += ` ${typed - added} already on the list.`;
  });
  search.addEventListener('input', draw);

  exportBtn.addEventListener('click', () => {
    const cell = (v) => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    const map = replies();
    const lines = [['Name', 'Status', 'Eating', 'Dietary', 'Source']];
    for (const p of [...people].sort((a, b) => a.name.localeCompare(b.name))) {
      const { status, source } = statusOf(p, map);
      const g = map.get(norm(p.name));
      lines.push([p.name, LABEL[status], g && g.attending ? (g.eating ? 'Yes' : 'No') : '', (g && g.dietary) || '', source]);
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.map((l) => l.map(cell).join(',')).join('\r\n')], { type: 'text/csv' }));
    a.download = 'wedding-invite-list.csv';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  draw();
  return {
    setRsvps(rows) { rsvps = rows; draw(); },
    async load() {
      try {
        people = (await store.loadInvites()).map((p) => ({ id: p.id, name: p.name, manual: p.manual || '' }));
      } catch (err) {
        console.error(err);
        msg.textContent = 'Could not load the invite list. Refresh the page to try again.';
      }
      loaded = true;
      draw();
    },
  };
}
