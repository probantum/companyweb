require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const morgan = require('morgan');

const icons = require('./src/icons');
const db = require('./src/db');
const asyncHandler = require('./src/asyncHandler');
const siteRouter = require('./src/routes/site');
const adminRouter = require('./src/routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Required behind a reverse proxy (nginx, Render, etc.) so express-session sees
// the original protocol and can set secure cookies correctly.
if (isProduction) app.set('trust proxy', 1);

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'insecure-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8, secure: isProduction },
  })
);

// Available to every view without passing it through each render() call.
app.locals.icons = icons;

// Footer contact details are admin-configurable — load once per request so
// every view (via footer.ejs) can read res.locals.settings without each
// route handler having to fetch and pass it explicitly.
app.use(
  asyncHandler(async (req, res, next) => {
    res.locals.settings = await db.getById('settings', 'default');
    next();
  })
);

app.use('/', siteRouter);
app.use('/admin', adminRouter);

app.use((req, res) => {
  res.status(404).render('site/404', { path: req.path });
});

app.listen(PORT, () => {
  console.log(`ProBantum site running at http://localhost:${PORT}`);
});

db.testConnection()
  .then(() => console.log('MySQL connection OK'))
  .catch((err) => {
    console.error('--------------------------------------------------------------');
    console.error('Could not connect to MySQL — pages that read/write data will 500.');
    console.error('Check DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME in .env');
    console.error('and that sql/schema.sql has been run against that database.');
    console.error(err.message);
    console.error('--------------------------------------------------------------');
  });
