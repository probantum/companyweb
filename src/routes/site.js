const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const content = require('../content');
const asyncHandler = require('../asyncHandler');
const mailer = require('../mailer');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const portfolio = await db.getAll('portfolio');
    res.render('site/home', {
      active: 'Home',
      services: content.services,
      metrics: content.metrics,
      portfolioTeaser: portfolio.slice(0, 3),
    });
  })
);

router.get('/services', (req, res) => {
  res.redirect('/#services');
});

router.get(
  '/portfolio',
  asyncHandler(async (req, res) => {
    res.render('site/portfolio', { active: 'Portfolio', portfolio: await db.getAll('portfolio') });
  })
);

router.get(
  '/portfolio/:id',
  asyncHandler(async (req, res) => {
    const item = await db.getById('portfolio', req.params.id);
    if (!item) return res.status(404).render('site/404', { path: req.path });
    res.render('site/portfolio-detail', { active: 'Portfolio', item });
  })
);

router.get(
  '/blog',
  asyncHandler(async (req, res) => {
    res.render('site/blog', { active: 'Blog', posts: await db.getAll('blogPosts') });
  })
);

router.get(
  '/blog/:slug',
  asyncHandler(async (req, res) => {
    const posts = await db.getAll('blogPosts');
    const post = posts.find((p) => p.slug === req.params.slug);
    if (!post) return res.status(404).render('site/404', { path: req.path });
    res.render('site/blog-post', { active: 'Blog', post });
  })
);

router.get(
  '/cards',
  asyncHandler(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const staffList = await db.getAll('staff');
    const staff = await Promise.all(
      staffList.map(async (person) => ({
        ...person,
        qrSvg: await QRCode.toString(`${baseUrl}/cards/${person.id}`, {
          type: 'svg',
          margin: 0,
          color: { dark: '#060a14', light: '#ffffff' },
        }),
      }))
    );
    res.render('site/cards', { active: 'Contact Cards', staff });
  })
);

router.get(
  '/cards/:id',
  asyncHandler(async (req, res) => {
    const person = await db.getById('staff', req.params.id);
    if (!person) return res.status(404).render('site/404', { path: req.path });
    res.render('site/card-detail', { active: 'Contact Cards', person });
  })
);

router.get(
  '/cards/:id/vcard',
  asyncHandler(async (req, res) => {
    const person = await db.getById('staff', req.params.id);
    if (!person) return res.status(404).send('Not found');

    const [first, ...rest] = person.name.split(' ');
    const last = rest.join(' ');
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${last};${first};;;`,
      `FN:${person.name}`,
      'ORG:ProBantum Technologies',
      `TITLE:${person.role}`,
      `EMAIL;TYPE=WORK:${person.email}`,
      `TEL;TYPE=WORK,VOICE:${person.phone}`,
      `URL:https://${person.linkedin}`,
      'END:VCARD',
    ].join('\r\n');

    res.set('Content-Type', 'text/vcard');
    res.set('Content-Disposition', `attachment; filename="${person.name.replace(/\s+/g, '-')}.vcf"`);
    res.send(vcard);
  })
);

router.get('/contact', (req, res) => {
  res.redirect('/#contact');
});

router.get('/privacy', (req, res) => {
  res.render('site/privacy', { active: '' });
});

router.get('/legal', (req, res) => {
  res.render('site/legal', { active: '' });
});

router.post(
  '/contact',
  asyncHandler(async (req, res) => {
    const { name, email, topic, message } = req.body;

    const renderHome = async (extra) => {
      const portfolio = await db.getAll('portfolio');
      res.render('site/home', {
        active: 'Home',
        services: content.services,
        metrics: content.metrics,
        portfolioTeaser: portfolio.slice(0, 3),
        submitted: false,
        error: null,
        ...extra,
      });
    };

    if (!name || !email || !message) {
      res.status(400);
      return renderHome({ error: 'Name, email and message are required.' });
    }

    const submission = await db.insert('submissions', {
      name,
      email,
      topic: topic || 'Other',
      subject: topic || 'General inquiry',
      message,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'New',
    });

    try {
      await mailer.notifyNewSubmission(submission);
    } catch (err) {
      console.error('[mailer] Failed to send new-submission notification:', err.message);
    }

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ ok: true });
    }

    await renderHome({ submitted: true });
  })
);

module.exports = router;
