const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');
const { redirectIfAuth } = require('../middleware/auth');

// GET Login
router.get('/login', redirectIfAuth, (req, res) => {
  res.render('auth/login', { title: 'Iniciar Sesión', error: null, success: null });
});

// POST Login
router.post('/login', redirectIfAuth, async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data: user } = await supabaseAdmin.from('users').select('*').eq('email', email.toLowerCase()).eq('is_active', true).single();
    
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.render('auth/login', { title: 'Iniciar Sesión', error: 'Email o contraseña incorrectos', success: null });
    }

    req.session.user = { id: user.id, email: user.email, full_name: user.full_name, role: user.role, avatar_url: user.avatar_url };
    
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    console.error(err);
    res.render('auth/login', { title: 'Iniciar Sesión', error: 'Error interno. Intenta de nuevo.', success: null });
  }
});

// GET Register
router.get('/registro', redirectIfAuth, (req, res) => {
  res.render('auth/register', { title: 'Crear Cuenta', error: null });
});

// POST Register
router.post('/registro', redirectIfAuth, async (req, res) => {
  const { full_name, email, phone, password, confirm_password } = req.body;
  
  if (password !== confirm_password) {
    return res.render('auth/register', { title: 'Crear Cuenta', error: 'Las contraseñas no coinciden' });
  }
  if (password.length < 8) {
    return res.render('auth/register', { title: 'Crear Cuenta', error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const { data: existing } = await supabaseAdmin.from('users').select('id').eq('email', email.toLowerCase()).single();
    if (existing) {
      return res.render('auth/register', { title: 'Crear Cuenta', error: 'Este email ya está registrado' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabaseAdmin.from('users').insert({
      email: email.toLowerCase(), password_hash, full_name, phone, role: 'customer'
    }).select().single();

    if (error) throw error;

    req.session.user = { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
    
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    console.error(err);
    res.render('auth/register', { title: 'Crear Cuenta', error: 'Error al crear la cuenta. Intenta de nuevo.' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
