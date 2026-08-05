const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { redirectIfAuth } = require('../middleware/auth');

// GET Login
router.get('/login', redirectIfAuth, (req, res) => {
  res.render('auth/login', { title: 'Iniciar Sesión', error: null, success: null });
});

// POST Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('=== LOGIN ATTEMPT ===', email);
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    console.log('USER:', user ? user.email : 'NOT FOUND');
    console.log('ERROR:', error);

    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.render('auth/login', { title: 'Iniciar Sesión', error: 'Email o contraseña incorrectos', success: null });
    }

    req.session.user = { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
    console.log('SESSION SET:', req.session.user);

    req.session.save((err) => {
      if (err) {
        console.log('SESSION SAVE ERROR:', err);
        return res.render('auth/login', { title: 'Iniciar Sesión', error: 'Error al guardar sesión', success: null });
      }
      console.log('SESSION SAVED OK');
      res.redirect('/');
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.render('auth/login', { title: 'Iniciar Sesión', error: 'Error interno. Intenta de nuevo.', success: null });
  }
});

// GET Register
router.get('/registro', redirectIfAuth, (req, res) => {
  res.render('auth/register', { title: 'Crear Cuenta', error: null });
});

// POST Register
router.post('/registro', async (req, res) => {
  const { full_name, email, phone, password, confirm_password } = req.body;
  if (password !== confirm_password) {
    return res.render('auth/register', { title: 'Crear Cuenta', error: 'Las contraseñas no coinciden' });
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
    req.session.save((err) => {
      if (err) return res.redirect('/auth/login');
      res.redirect('/');
    });
  } catch (err) {
    console.error(err);
    res.render('auth/register', { title: 'Crear Cuenta', error: 'Error al crear la cuenta.' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// =============================
// RECUPERAR CONTRASEÑA
// =============================
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

router.get('/recuperar', (req, res) => {
  res.render('auth/forgot-password', { title: 'Recuperar Contrasena', error: null, success: null });
});

router.post('/recuperar', async (req, res) => {
  const { email } = req.body;
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    const successMsg = 'Si ese email esta registrado, recibiras un enlace en unos minutos.';

    if (!user) {
      return res.render('auth/forgot-password', { title: 'Recuperar Contrasena', error: null, success: successMsg });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await supabaseAdmin.from('users').update({
      reset_token: token,
      reset_token_expires: expires.toISOString()
    }).eq('id', user.id);

    const resetUrl = `${process.env.BASE_URL}/auth/reset/${token}`;

    await resend.emails.send({
      from: 'Auto Premium Service <onboarding@resend.dev>',
      to: user.email,
      subject: 'Recuperar contrasena - Auto Premium Service',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
          <h2 style="color:#e63946">Auto Premium Service</h2>
          <p>Hola ${user.full_name},</p>
          <p>Recibimos una solicitud para restablecer tu contrasena. Haz clic en el boton para continuar:</p>
          <a href="${resetUrl}" style="display:inline-block;background:#e63946;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin:1rem 0">
            Restablecer contrasena
          </a>
          <p style="color:#888;font-size:0.85rem">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este mensaje.</p>
        </div>
      `
    });

    res.render('auth/forgot-password', { title: 'Recuperar Contrasena', error: null, success: successMsg });
  } catch (err) {
    console.error('Recuperar error:', err);
    res.render('auth/forgot-password', { title: 'Recuperar Contrasena', error: 'Error al procesar la solicitud.', success: null });
  }
});

// =============================
// RESET CONTRASENA
// =============================
router.get('/reset/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, reset_token_expires')
      .eq('reset_token', token)
      .single();

    if (!user || new Date(user.reset_token_expires) < new Date()) {
      return res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'El enlace es invalido o ha expirado.', success: null, token: null });
    }

    res.render('auth/reset-password', { title: 'Nueva Contrasena', error: null, success: null, token });
  } catch (err) {
    res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'Enlace invalido.', success: null, token: null });
  }
});

router.post('/reset/:token', async (req, res) => {
  const { token } = req.params;
  const { password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'Las contrasenas no coinciden.', success: null, token });
  }
  if (password.length < 6) {
    return res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'La contrasena debe tener al menos 6 caracteres.', success: null, token });
  }

  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, reset_token_expires')
      .eq('reset_token', token)
      .single();

    if (!user || new Date(user.reset_token_expires) < new Date()) {
      return res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'El enlace es invalido o ha expirado.', success: null, token: null });
    }

    const password_hash = await bcrypt.hash(password, 12);

    await supabaseAdmin.from('users').update({
      password_hash,
      reset_token: null,
      reset_token_expires: null
    }).eq('id', user.id);

    res.render('auth/reset-password', { title: 'Nueva Contrasena', error: null, success: 'Contrasena actualizada! Ya puedes iniciar sesion.', token: null });
  } catch (err) {
    console.error('Reset error:', err);
    res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'Error al actualizar la contrasena.', success: null, token });
  }
});

module.exports = router;