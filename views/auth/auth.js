const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { redirectIfAuth } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../config/email');

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

// ============================================
// RECUPERACIÓN DE CONTRASEÑA
// ============================================

// GET - Formulario para ingresar email
router.get('/recuperar', redirectIfAuth, (req, res) => {
  res.render('auth/forgot-password', { title: 'Recuperar Contraseña', error: null, success: null });
});

// POST - Enviar email con enlace de recuperación
router.post('/recuperar', async (req, res) => {
  const { email } = req.body;
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    // Siempre mostrar el mismo mensaje por seguridad (no revelar si el email existe)
    const successMsg = 'Si ese email está registrado, recibirás un enlace para restablecer tu contraseña.';

    if (!user) {
      return res.render('auth/forgot-password', { title: 'Recuperar Contraseña', error: null, success: successMsg });
    }

    // Generar token seguro
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Borrar tokens anteriores del mismo email y guardar el nuevo
    await supabaseAdmin.from('password_resets').delete().eq('email', email.toLowerCase());
    await supabaseAdmin.from('password_resets').insert({
      email: email.toLowerCase(),
      token,
      expires_at: expires_at.toISOString()
    });

    // Enviar email
    const resetUrl = `${process.env.APP_URL}/auth/reset/${token}`;
    await sendPasswordResetEmail(user, resetUrl);

    res.render('auth/forgot-password', { title: 'Recuperar Contraseña', error: null, success: successMsg });
  } catch (err) {
    console.error('RESET ERROR:', err);
    res.render('auth/forgot-password', { title: 'Recuperar Contraseña', error: 'Error interno. Intenta de nuevo.', success: null });
  }
});

// GET - Formulario para ingresar nueva contraseña
router.get('/reset/:token', redirectIfAuth, async (req, res) => {
  const { token } = req.params;
  try {
    const { data: reset } = await supabaseAdmin
      .from('password_resets')
      .select('*')
      .eq('token', token)
      .single();

    if (!reset || new Date(reset.expires_at) < new Date()) {
      return res.render('auth/reset-password', {
        title: 'Restablecer Contraseña',
        token: null,
        error: 'El enlace es inválido o ha expirado. Solicita uno nuevo.',
        success: null
      });
    }

    res.render('auth/reset-password', { title: 'Restablecer Contraseña', token, error: null, success: null });
  } catch (err) {
    console.error(err);
    res.render('auth/reset-password', { title: 'Restablecer Contraseña', token: null, error: 'Error interno.', success: null });
  }
});

// POST - Guardar nueva contraseña
router.post('/reset/:token', async (req, res) => {
  const { token } = req.params;
  const { password, confirm_password } = req.body;

  if (password !== confirm_password) {
    return res.render('auth/reset-password', {
      title: 'Restablecer Contraseña',
      token,
      error: 'Las contraseñas no coinciden.',
      success: null
    });
  }

  if (password.length < 6) {
    return res.render('auth/reset-password', {
      title: 'Restablecer Contraseña',
      token,
      error: 'La contraseña debe tener al menos 6 caracteres.',
      success: null
    });
  }

  try {
    const { data: reset } = await supabaseAdmin
      .from('password_resets')
      .select('*')
      .eq('token', token)
      .single();

    if (!reset || new Date(reset.expires_at) < new Date()) {
      return res.render('auth/reset-password', {
        title: 'Restablecer Contraseña',
        token: null,
        error: 'El enlace es inválido o ha expirado. Solicita uno nuevo.',
        success: null
      });
    }

    // Actualizar contraseña
    const password_hash = await bcrypt.hash(password, 12);
    await supabaseAdmin.from('users').update({ password_hash }).eq('email', reset.email);

    // Eliminar el token usado
    await supabaseAdmin.from('password_resets').delete().eq('token', token);

    res.render('auth/reset-password', {
      title: 'Restablecer Contraseña',
      token: null,
      error: null,
      success: '¡Contraseña actualizada! Ya puedes iniciar sesión.'
    });
  } catch (err) {
    console.error(err);
    res.render('auth/reset-password', {
      title: 'Restablecer Contraseña',
      token,
      error: 'Error interno. Intenta de nuevo.',
      success: null
    });
  }
});

module.exports = router;