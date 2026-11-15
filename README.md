# Emily & Zac wedding site

A free wedding website with two sides:

- **Guest site** (`index.html`): wedding details and the RSVP form. After a guest RSVPs they see the amount to pay and the bank details.
- **Admin page** (`admin.html`): private login for the couple. Shows every RSVP, totals, a "paid" tick box per party, and a spreadsheet export.

Hosting is GitHub Pages. RSVPs and the login are stored in Firebase (free tier). There are no payment fees because guests pay by bank transfer or PayID.

Until Firebase is connected the site runs in **preview mode**: everything works, but RSVPs are only saved in the browser you are using.

## Going live

### 1. Turn on GitHub Pages
Repo → Settings → Pages → Source: "Deploy from a branch" → Branch `main`, folder `/ (root)` → Save.
The site appears at `https://mteck776-debug.github.io/emily-zac-wedding/`.

### 2. Create the Firebase project
1. Go to <https://console.firebase.google.com> → Add project (Google Analytics can be off).
2. **Build → Firestore Database** → Create database → Production mode → pick the `australia-southeast1` (Sydney) location.
3. Firestore → **Rules** tab → replace everything with the contents of `firestore.rules` from this repo → Publish.
4. **Build → Authentication** → Get started → Sign-in method → enable **Email/Password**.
5. Authentication → **Users** → Add user. Enter the couple's email and a strong password. Copy the **User UID** shown in the list.
6. Firestore → **Data** → Start collection, ID `admins` → Document ID = the User UID you copied → add any field (for example `name` = `Emily`) → Save. Repeat steps 5 and 6 for anyone else who should see the guest list.
7. Authentication → **Settings** → Authorised domains → add `mteck776-debug.github.io`.

### 3. Connect the site
1. Firebase → Project settings (cog) → Your apps → Web (`</>`) → register an app (no hosting needed).
2. Copy the `firebaseConfig = { ... }` object it shows.
3. In `js/config.js`, replace `null` with that object:
   ```js
   export const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     // etc.
   };
   ```
   These values are safe to commit. They identify the project; the database rules are what protect the data.

### 4. Set the guest code and bank details
1. Open `…/admin.html` and sign in.
2. Under "Guest code & bank details", choose a guest code and enter the account details. Save.
3. Copy the guest link it shows and send that to guests. The code is filled in for them.

Bank details live in the database, not in this repo, and can only be read by someone who has the guest code.

## Changing things

- **Wording, times, links:** edit `index.html`.
- **Meal price, ceremony time:** edit `js/config.js`.
- **Colours and fonts:** the variables at the top of `css/style.css`.
- **Hero photo:** add a photo at `images/hero.jpg` (landscape or portrait, around 2000px on the long side). Without one the hero shows a burgundy background.
