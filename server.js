require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'autopremium-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global template variables
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.cart = req.session.cart || { items: [], total: 0, count: 0 };
  res.locals.stripePK = process.env.STRIPE_PUBLISHABLE_KEY || '';
  next();
});

// ============================================
// ROUTES
// ============================================
app.use('/', require('./routes/shop'));
app.use('/auth', require('./routes/auth'));
app.use('/cart', require('./routes/cart'));
app.use('/checkout', require('./routes/checkout'));
app.use('/account', require('./routes/account'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));

// ============================================
// ERROR HANDLING
// ============================================
app.use((req, res) => {
  res.status(404).render('404', { title: 'Página no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).render('error', { 
    title: 'Error del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║     AUTO PREMIUM SERVICE               ║
  ║     Servidor corriendo en :${PORT}        ║
  ╚════════════════════════════════════════╝
  `);
});

module.exports = app;
