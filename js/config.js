// ── Firebase connection ─────────────────────────────────────────────
// Leave as null to run in demo mode (RSVPs are only saved in the browser
// you are using). To go live, paste the config object from
// Firebase console → Project settings → Your apps → Web app. See README.
export const firebaseConfig = null;

// ── Wedding details used by the scripts ─────────────────────────────
export const site = {
  couple: 'Emily & Zac',
  pricePerPerson: 65,                      // meal cost per guest, AUD
  ceremony: '2027-10-23T15:00:00+11:00',   // 3pm Tasmanian time
  maxGuestsPerRsvp: 12,
};
