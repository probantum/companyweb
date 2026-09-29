# Handover — ProBantum Technologies site

For whoever picks this up next. Quick orientation, what to do before launch, and where
the load-bearing decisions are.

## What this is

A Node/Express + EJS marketing site and admin panel for ProBantum Technologies, built
on the "Dark Network" design (`probantum_new/` holds the original mockups this was
implemented from — kept as a reference, not served by the app, safe to delete once
nobody needs to compare against it anymore).

Full technical rundown (stack, folder structure, what's admin-managed vs. static copy)
is in `README.md`. Deployment instructions (VPS/Render/Railway, env vars, DB setup) are
in `DEPLOY.md`. This file is the "start here" layer above both.

## Running it locally

```bash
npm install
cp .env.example .env
mysql -u probantum -p probantum < sql/schema.sql   # see DEPLOY.md for full DB setup
npm run dev
```

Site: http://localhost:3000 — Admin: http://localhost:3000/admin/login (`admin` /
`admin123` until you change it, see below).

## Before this goes live — checklist

- [ ] **Replace the sample content.** The blog posts, portfolio case studies and staff
      contact cards currently in the database (James Mwangi, Paula Carmen, David
      Otieno, etc.) are seed/demo data from `src/data/db.json`, not real ProBantum
      content. Replace or delete them via `/admin` before launch.
- [ ] **Change the admin password.** Ships with `admin` / `admin123`. Generate a real
      one: `node scripts/hash-password.js "your-real-password"` → put the output in
      `ADMIN_PASSWORD_HASH` in `.env`.
- [ ] **Set a real `SESSION_SECRET`** and **`NODE_ENV=production`** — both covered in
      `DEPLOY.md` → "Before you deploy."
- [ ] **Have the Privacy and Legal page copy reviewed** (`/privacy`, `/legal`) — it's
      genuinely functional boilerplate, not a substitute for legal advice. Both pages
      say so at the bottom; worth having counsel look at before launch regardless.
- [ ] **If you're upgrading an existing deployment** (not a fresh database), run the
      `ALTER TABLE` migration in `DEPLOY.md` → "Database setup" step 2 — a couple of
      columns (staff photos, footer contact details) were added after some databases
      were already set up.

## Things worth knowing before you touch the code

- **Home is one scrolling page**, not separate Services/Approach/Industries/Contact
  routes. Those are `#services` / `#approach` / `#industries` / `#contact` anchors
  inside `views/site/home.ejs`. `GET /services` and `GET /contact` just redirect to the
  matching anchor, for old links. Blog, Portfolio and Contact Cards are still real
  separate pages/routes (they need individual permalinks).
- **The Contact Card detail page (`/cards/:id`) has no nav or footer, on purpose.** It's
  what someone sees after scanning a staff member's QR code — a standalone digital
  business card, not a page within the site. Don't "fix" this by adding the site chrome
  back.
- **The contact form's "Company / Organisation" field isn't a separate database
  column.** The backend only stores `name`/`email`/`topic`/`message`. Rather than add a
  column for one field, its value gets prepended into the message body client-side
  before submit (`Company: X`) — so nothing's silently lost, but if you're looking for
  a `company` field in `/admin/submissions` and not finding one, that's why. Fix
  properly (add a real column) if this bothers you.
- **`public/css/admin.css` doesn't have its own color palette** — it reads the same
  CSS custom properties (`--ink`, `--cyan`, `--muted`, etc.) that `public/css/site.css`
  defines at `:root`, via an alias block at the top of `admin.css` that maps legacy
  token names (`--bg`, `--text-muted`, `--accent`, ...) onto them. If you ever replace
  `site.css`'s design tokens again (like happened once already — see the alias block's
  comment for the story), admin.css will silently break the same way unless you update
  that alias block too.
- **`src/content.js`** holds the home page's services copy (not admin-managed — there's
  no CMS screen for it in the mockup). Blog, Portfolio, Contact Cards and Settings
  (footer contact details, notification emails) are the things actually editable from
  `/admin`.

## What's NOT done / out of scope so far

- No automated tests.
- No CI.
- No analytics/cookie consent — the only client-side storage is a `localStorage` theme
  preference (Day/Dusk/Night), mentioned in `/privacy`.
