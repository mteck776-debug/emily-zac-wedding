// Default website content. Anything saved from the "Edit website" tab on the
// admin page overrides these values. {price} in any text shows the meal price.
export const defaults = {
  pageTitle: 'Emily & Zac · 23 October 2027',
  price: 65,
  ceremony: '2027-10-23T15:00',          // venue local time (Tasmania)
  showCountdown: true,
  theme: { primary: '#6d2230', accent: '#c9a57c', background: '#faf5ee', tint: '#ead9c3' },
  hero: {
    eyebrow: 'Our greatest adventure yet',
    name1: 'Emily',
    name2: 'Zac',
    date: 'Saturday 23 October 2027',
    place: 'Spreyton Cider Co · Tasmania',
    button: 'RSVP',
  },
  where: {
    show: true, nav: 'Where', eyebrow: 'Where', title: 'Spreyton Cider Co',
    text: 'The ceremony and reception will both be held at Spreyton Cider Co.',
    address: '6 Melrose Rd, Aberdeen, Tasmania 7310',
    button: 'Open in Maps',
  },
  schedule: {
    show: true, nav: 'Schedule', eyebrow: 'Saturday 23 October', title: 'Schedule of events',
    items: [
      { time: '2:30 pm', title: 'Arrive', text: 'Please arrive 30 minutes early so nobody walks in once the ceremony has started.', note: '' },
      { time: '3:00 pm', title: 'Ceremony', text: 'The ceremony starts at 3pm sharp.', note: '' },
      { time: '3:30 pm', title: 'After the ceremony', text: 'Guests move to the reception to mingle while the bride and groom take family photos, couple portraits and group photos.', note: '' },
      { time: '3:30 – 11:30 pm', title: 'Reception & party time', text: 'Formalities include the entrance, a few speeches and the cake cutting. After that the dance floor is open to boogie. There will be games on the lawn if the weather permits, and other entertainment.', note: 'Loud music off by 10:30pm. Venue vacant by midnight.' },
    ],
  },
  stay: {
    show: true, nav: 'Stay', eyebrow: 'Accommodation', title: 'Where to stay',
    items: [
      { title: 'Airbnb', text: 'There are plenty of great Airbnb options in the area.', linkText: 'Browse Airbnb', url: 'https://www.airbnb.com.au/s/Spreyton--Tasmania--Australia/homes' },
      { title: 'Devonport', text: 'More options in Devonport, a short 10 minute drive from the venue.', linkText: 'Browse Booking.com', url: 'https://www.booking.com/searchresults.html?ss=Devonport%2C+Tasmania%2C+Australia' },
    ],
  },
  faq: {
    show: true, nav: 'FAQ', eyebrow: 'Good to know', title: 'Frequently asked questions',
    items: [
      { q: 'Dress code & theme', a: 'Dress up! The colour theme is earthy colours that complement burgundy and tan. The bridesmaids are wearing burgundy, so please avoid matching them. And for the ladies, no white.' },
      { q: 'Parking & accessibility', a: 'Parking is available and easy to reach, with plenty of signs to point the way.' },
      { q: 'Food & dietary requirements', a: 'Food will be canapé style, and we will make sure everyone is fed. Please add any dietary requirements when you RSVP.' },
      { q: 'Paying for meals', a: 'Meals are covered by guests at ${price} per person. If you would rather not eat at the wedding, that is fine too. Bank details appear once you have sent your RSVP.' },
    ],
  },
  rsvp: {
    nav: 'RSVP', eyebrow: "We can't wait to celebrate with you", title: 'RSVP',
    accept: 'Joyfully accepts',
    decline: 'Regretfully declines',
    food: 'Having food at the wedding (${price})',
    button: 'Send RSVP',
    thanksTitle: "You're on the list!",
    thanksPay: 'Thank you for your RSVP. To confirm your meals, please transfer the amount below.',
    thanksNoPay: 'Thank you for your RSVP. We can’t wait to see you there.',
    sorryTitle: 'Thank you for letting us know',
    sorryText: "We're sorry you can't make it and we'll miss you on the day.",
  },
  footer: { date: '23 . 10 . 2027' },
};

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Saved content laid over the defaults. Lists are replaced whole. */
export function merge(base, over) {
  if (Array.isArray(base)) return Array.isArray(over) ? clone(over) : clone(base);
  if (base && typeof base === 'object') {
    const out = {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], over && typeof over === 'object' ? over[k] : undefined);
    return out;
  }
  if (over === undefined || over === null || typeof over !== typeof base) return base;
  return over;
}

export const get = (obj, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);
export function set(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((a, k) => a[k], obj)[last] = value;
}

/** Text with {price} filled in. */
export const fill = (text, content) => String(text ?? '').replaceAll('{price}', content.price);

/** A "YYYY-MM-DDTHH:MM" time at the venue (Tasmania) as a real Date. */
export function venueTime(local) {
  const asUtc = new Date(local + ':00Z');
  if (isNaN(asUtc)) return null;
  const inZone = (tz) => new Date(asUtc.toLocaleString('en-US', { timeZone: tz }));
  return new Date(asUtc.getTime() - (inZone('Australia/Hobart') - inZone('UTC')));
}

/** Push the theme colours into the page. */
export function applyTheme(theme, root = document.documentElement) {
  root.style.setProperty('--burgundy', theme.primary);
  root.style.setProperty('--tan', theme.accent);
  root.style.setProperty('--cream', theme.background);
  root.style.setProperty('--tan-soft', theme.tint);
}
