const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../asyncHandler');

const router = express.Router();

const uploadStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'public', 'uploads'),
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error('Only PNG, JPEG, WEBP or GIF images are allowed.'));
    }
    cb(null, true);
  },
});

// ---------- Auth ----------

router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = username === process.env.ADMIN_USERNAME;
  const validPass = validUser && bcrypt.compareSync(password || '', process.env.ADMIN_PASSWORD_HASH || '');

  if (!validUser || !validPass) {
    return res.status(401).render('admin/login', { error: 'Invalid username or password.' });
  }

  req.session.isAdmin = true;
  req.session.username = username;
  res.redirect('/admin/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.get('/', (req, res) => res.redirect('/admin/dashboard'));

// Everything below requires a logged-in admin.
router.use(requireAuth);

// ---------- Dashboard ----------

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const [submissions, blogPosts, portfolio, staff] = await Promise.all([
      db.getAll('submissions'),
      db.getAll('blogPosts'),
      db.getAll('portfolio'),
      db.getAll('staff'),
    ]);
    res.render('admin/dashboard', {
      active: 'Dashboard',
      counts: {
        submissions: submissions.length,
        newSubmissions: submissions.filter((s) => s.status === 'New').length,
        blogPosts: blogPosts.length,
        portfolio: portfolio.length,
        staff: staff.length,
      },
      recentSubmissions: submissions.slice(-5).reverse(),
    });
  })
);

// ---------- Contact submissions ----------

router.get(
  '/submissions',
  asyncHandler(async (req, res) => {
    const submissions = [...(await db.getAll('submissions'))].reverse();
    res.render('admin/submissions', { active: 'Contact Submissions', submissions });
  })
);

router.post(
  '/submissions/:id/status',
  asyncHandler(async (req, res) => {
    await db.update('submissions', req.params.id, { status: req.body.status });
    res.redirect('/admin/submissions');
  })
);

router.post(
  '/submissions/:id/delete',
  asyncHandler(async (req, res) => {
    await db.remove('submissions', req.params.id);
    res.redirect('/admin/submissions');
  })
);

// ---------- Blog posts ----------

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

router.get(
  '/blog',
  asyncHandler(async (req, res) => {
    res.render('admin/blog', { active: 'Blog Posts', posts: await db.getAll('blogPosts') });
  })
);

router.post(
  '/blog',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { title, category, excerpt, author, date, readTime, tags, content } = req.body;
    await db.insert('blogPosts', {
      title,
      slug: slugify(title),
      category,
      excerpt,
      author,
      date,
      readTime,
      tags: (tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      content,
      image: req.file ? `/uploads/${req.file.filename}` : null,
    });
    res.redirect('/admin/blog');
  })
);

router.post(
  '/blog/:id',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { title, category, excerpt, author, date, readTime, tags, content } = req.body;
    const patch = {
      title,
      slug: slugify(title),
      category,
      excerpt,
      author,
      date,
      readTime,
      tags: (tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      content,
    };
    if (req.file) patch.image = `/uploads/${req.file.filename}`;
    await db.update('blogPosts', req.params.id, patch);
    res.redirect('/admin/blog');
  })
);

router.post(
  '/blog/:id/delete',
  asyncHandler(async (req, res) => {
    await db.remove('blogPosts', req.params.id);
    res.redirect('/admin/blog');
  })
);

// ---------- Portfolio ----------

router.get(
  '/portfolio',
  asyncHandler(async (req, res) => {
    res.render('admin/portfolio', { active: 'Portfolio', portfolio: await db.getAll('portfolio') });
  })
);

const portfolioUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'gallery', maxCount: 10 },
]);

router.post(
  '/portfolio',
  portfolioUpload,
  asyncHandler(async (req, res) => {
    const { name, desc, tags, tag } = req.body;
    const files = req.files || {};
    await db.insert('portfolio', {
      name,
      desc,
      tags: (tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      tag: tag || (tags || '').split(',')[0] || '',
      image: files.image ? `/uploads/${files.image[0].filename}` : null,
      gallery: (files.gallery || []).map((f) => `/uploads/${f.filename}`),
    });
    res.redirect('/admin/portfolio');
  })
);

router.post(
  '/portfolio/:id',
  portfolioUpload,
  asyncHandler(async (req, res) => {
    const { name, desc, tags, tag, removeGallery } = req.body;
    const files = req.files || {};
    const patch = {
      name,
      desc,
      tags: (tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      tag: tag || (tags || '').split(',')[0] || '',
    };
    if (files.image) patch.image = `/uploads/${files.image[0].filename}`;

    const existing = await db.getById('portfolio', req.params.id);
    const toRemove = new Set(
      (Array.isArray(removeGallery) ? removeGallery : removeGallery ? [removeGallery] : [])
    );
    const kept = (existing?.gallery || []).filter((url) => !toRemove.has(url));
    const added = (files.gallery || []).map((f) => `/uploads/${f.filename}`);
    patch.gallery = [...kept, ...added];

    await db.update('portfolio', req.params.id, patch);
    res.redirect('/admin/portfolio');
  })
);

router.post(
  '/portfolio/:id/delete',
  asyncHandler(async (req, res) => {
    await db.remove('portfolio', req.params.id);
    res.redirect('/admin/portfolio');
  })
);

// ---------- Contact cards (staff) ----------

router.get(
  '/cards',
  asyncHandler(async (req, res) => {
    res.render('admin/cards', { active: 'Contact Cards', staff: await db.getAll('staff') });
  })
);

router.post(
  '/cards',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { name, role, email, phone, linkedin } = req.body;
    await db.insert('staff', {
      name,
      role,
      email,
      phone,
      linkedin,
      image: req.file ? `/uploads/${req.file.filename}` : null,
    });
    res.redirect('/admin/cards');
  })
);

router.post(
  '/cards/:id',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { name, role, email, phone, linkedin } = req.body;
    const patch = { name, role, email, phone, linkedin };
    if (req.file) patch.image = `/uploads/${req.file.filename}`;
    await db.update('staff', req.params.id, patch);
    res.redirect('/admin/cards');
  })
);

router.post(
  '/cards/:id/delete',
  asyncHandler(async (req, res) => {
    await db.remove('staff', req.params.id);
    res.redirect('/admin/cards');
  })
);

// ---------- Settings ----------

router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await db.getById('settings', 'default');
    res.render('admin/settings', { active: 'Settings', settings: settings || { notifyEmails: [] } });
  })
);

router.post(
  '/settings',
  asyncHandler(async (req, res) => {
    const notifyEmails = (req.body.notifyEmails || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    await db.update('settings', 'default', { notifyEmails });
    res.redirect('/admin/settings');
  })
);

router.post(
  '/settings/contact',
  asyncHandler(async (req, res) => {
    const { contactEmail, contactPhone, contactLocation } = req.body;
    await db.update('settings', 'default', { contactEmail, contactPhone, contactLocation });
    res.redirect('/admin/settings');
  })
);

// Surfaces multer upload failures (bad file type, too large) instead of a generic 500.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || /^Only PNG/.test(err.message || '')) {
    return res.status(400).send(`Upload error: ${err.message}`);
  }
  next(err);
});

module.exports = router;
