# Deploying ProBantum

This is a plain Node/Express app — no build step, no framework lock-in. Data (contact
submissions, blog posts, portfolio items, staff) lives in **MySQL**. Two things still
shape how you deploy it:

1. **Admin-uploaded images live on local disk**, in `public/uploads/`. That directory
   needs a **persistent, writable filesystem** that survives restarts and redeploys —
   MySQL doesn't hold these files, only the `/uploads/...` path string pointing at them.
2. **Sessions are in-memory** (`express-session`'s default `MemoryStore`). Fine for a
   single long-running process, but it means you can only run **one instance** — no
   horizontal scaling, no multiple dynos/replicas — without swapping in a shared session
   store (Redis, etc.), which this app doesn't have.

So: any host that runs your app as a single long-lived Node process, with a persistent
disk for `public/uploads/` and network access to a MySQL server, works — an AWS EC2
instance (or any VPS) fits that shape directly, which is what the steps below cover.

## Database setup (do this first, on any host)

1. **Create the database and a dedicated user** (don't run the app as MySQL `root`):
   ```sql
   CREATE DATABASE probantum CHARACTER SET utf8mb4;
   CREATE USER 'probantum'@'localhost' IDENTIFIED BY 'a-real-password';
   GRANT ALL PRIVILEGES ON probantum.* TO 'probantum'@'localhost';
   FLUSH PRIVILEGES;
   ```
2. **Create the tables:**
   ```bash
   mysql -u probantum -p probantum < sql/schema.sql
   ```
   **Already running an older deployment of this app?** `schema.sql` uses
   `CREATE TABLE IF NOT EXISTS`, so it won't add new columns to tables that already
   exist. Run this once against your existing database to pick up the staff photo and
   footer contact-details columns added since:
   ```sql
   ALTER TABLE staff ADD COLUMN IF NOT EXISTS image VARCHAR(500);
   ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
   ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
   ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_location VARCHAR(255);
   UPDATE settings SET contact_email = 'hello@probantum.com', contact_phone = '+254 700 000 000',
     contact_location = 'Nairobi, Kenya · Melbourne, AU' WHERE id = 'default' AND contact_email IS NULL;
   ```
3. **Set `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`** in `.env` to
   match. If MySQL runs on the same box as the app (the common case on a single VPS),
   `DB_HOST=localhost` is right.
4. **Sanity-check the connection** before starting the app:
   ```bash
   node scripts/test-db.js
   ```
5. **Bringing over the existing sample content** (the 6 seed blog posts, portfolio
   items, staff, and submissions this project shipped with)? Run the one-time migration
   against the `src/data/db.json` file still in this repo:
   ```bash
   node scripts/migrate-json-to-mysql.js
   ```
   Skip this if you're starting the MySQL tables empty and adding content through
   `/admin` yourself.

`server.js` pings the database once at boot and logs a clear error (with the exact env
vars to check) if it can't connect — check `pm2 logs` / your host's log viewer first if
pages that touch data are 500ing.

## Before you deploy

1. **Set a real admin password.** The repo ships with the default `admin` / `admin123`
   (hash already in `.env.example`). Generate your own:
   ```bash
   node scripts/hash-password.js "your-real-password"
   ```
   Put the output in `ADMIN_PASSWORD_HASH`, and pick a real `ADMIN_USERNAME`.

2. **Set a real `SESSION_SECRET`.** Any long random string:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Set `NODE_ENV=production`.** This is required for cookies to work correctly — it
   flips `express-session`'s cookie to `secure: true` (HTTPS-only) and tells Express to
   trust the `X-Forwarded-Proto` header from a reverse proxy (see `server.js`). Without
   it, the app assumes plain HTTP.

4. **Set the `SMTP_*` vars** if you want an email sent whenever someone submits the
   public contact form. Any SMTP provider works (Gmail, Zoho, your VPS's own mail
   server, etc.) — set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
   and `SMTP_FROM` in `.env`. Leaving `SMTP_HOST` unset is fine — the contact form still
   works, it just skips sending mail (logs a warning instead). Who actually receives
   these emails is configured separately, in the running app at **Admin → Settings**
   (comma-separated addresses, stored in the database, not `.env`).

5. Never commit `.env` — it's already gitignored. Set these as environment variables /
   secrets on whatever host you use instead.

## Deploying to a VPS (AWS EC2, DigitalOcean, Hetzner, Lightsail, your own box, ...)

This is the straightforward option and gives you full control over both MySQL and the
persistent disk. **If you're deploying to AWS EC2**, this is the option to follow — an
EC2 instance is just a VPS, so everything below applies as-is. A few EC2-specific notes:

- **Security group:** open inbound `80` and `443` (HTTP/HTTPS) and `22` (SSH) on the
  instance's security group — nothing else needs to be reachable from the internet.
  MySQL's `3306` should stay closed to the internet even if MySQL runs on the same box.
- **Persistent uploads is already satisfied.** EC2's root volume is EBS-backed and
  survives reboots/stops, so `public/uploads/` just needs to exist on it — no separate
  volume or S3 setup required (S3 is not one of the deploy options this app needs).
- **MySQL:** either install it directly on the instance (simplest, follow "Database
  setup" above as-is), or use **Amazon RDS for MySQL** instead — same `DB_*` env vars,
  just point `DB_HOST` at the RDS endpoint and make sure the EC2 instance's security
  group is allowed in RDS's security group on port `3306`.
- **No domain yet?** An Elastic IP keeps the instance's public address stable across
  reboots; you can run everything below against that IP and point nginx/certbot at a
  domain later once one exists.

1. **Install Node 20+** if it isn't already there:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```
   (MySQL is assumed already installed and running, per the Database setup above.)

2. **Clone and install:**
   ```bash
   git clone https://github.com/findambrose/probantum.git
   cd probantum
   npm ci --omit=dev
   cp .env.example .env
   # edit .env: real ADMIN_USERNAME / ADMIN_PASSWORD_HASH / SESSION_SECRET,
   # the DB_* values from the Database setup section, NODE_ENV=production, PORT=3000
   ```
   Then run the database setup steps above (schema + optional migration) if you haven't
   already.

3. **Keep it running with PM2** (auto-restarts on crash, survives reboot):
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name probantum
   pm2 save
   pm2 startup   # prints a command to run once, wires PM2 into systemd
   ```

4. **Put nginx in front of it** for TLS and a normal port 80/443. Create
   `/etc/nginx/sites-available/probantum`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       client_max_body_size 6M;   # a bit above the 5MB image upload limit
   }
   ```
   Then:
   ```bash
   sudo ln -s /etc/nginx/sites-available/probantum /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com   # free TLS cert, auto-renews
   ```

5. **Deploying updates:**
   ```bash
   cd probantum
   git pull
   npm ci --omit=dev
   pm2 restart probantum
   ```

6. **Back up MySQL and `public/uploads/`** regularly:
   ```bash
   mysqldump -u probantum -p probantum > backup-$(date +%F).sql
   ```
   plus a copy of `public/uploads/` (cron + rsync to another box, or a scheduled upload
   to S3/B2). Nothing else holds that data.

### Sharing a preview link without touching DNS

To hand someone a public link to a running instance without configuring DNS, cPanel, or
a subdomain, front it with a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
quick tunnel, kept alive by PM2 so the URL stays stable:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

pm2 start cloudflared --name tunnel-probantum -- tunnel --url http://localhost:3000
pm2 save
```

`pm2 logs tunnel-probantum` prints the `https://<random>.trycloudflare.com` URL — it
stays the same as long as that PM2 process isn't restarted. For a longer-lived link, use
a named Cloudflare Tunnel against a domain you control in Cloudflare instead.
