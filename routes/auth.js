const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { supabaseAdmin } = require('../config/supabase');
const { redirectIfAuth } = require('../middleware/auth');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

router.get('/login', redirectIfAuth, (req, res) => {
  res.render('auth/login', { title: 'Iniciar Sesion', error: null, success: null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data: user } = await supabaseAdmin.from('users').select('*').eq('email', email.toLowerCase()).eq('is_active', true).single();
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.render('auth/login', { title: 'Iniciar Sesion', error: 'Email o contrasena incorrectos', success: null });
    }
    req.session.user = { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
    req.session.save((err) => {
      if (err) return res.render('auth/login', { title: 'Iniciar Sesion', error: 'Error al guardar sesion', success: null });
      res.redirect('/');
    });
  } catch (err) {
    res.render('auth/login', { title: 'Iniciar Sesion', error: 'Error interno.', success: null });
  }
});

router.get('/registro', redirectIfAuth, (req, res) => {
  res.render('auth/register', { title: 'Crear Cuenta', error: null });
});

router.post('/registro', async (req, res) => {
  const { full_name, email, phone, password, confirm_password } = req.body;
  if (password !== confirm_password) return res.render('auth/register', { title: 'Crear Cuenta', error: 'Las contrasenas no coinciden' });
  try {
    const { data: existing } = await supabaseAdmin.from('users').select('id').eq('email', email.toLowerCase()).single();
    if (existing) return res.render('auth/register', { title: 'Crear Cuenta', error: 'Este email ya esta registrado' });
    const password_hash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabaseAdmin.from('users').insert({ email: email.toLowerCase(), password_hash, full_name, phone, role: 'customer' }).select().single();
    if (error) throw error;
    req.session.user = { id: user.id, email: user.email, full_name: user.full_name, role: user.role };
    req.session.save((err) => { if (err) return res.redirect('/auth/login'); res.redirect('/'); });
  } catch (err) {
    res.render('auth/register', { title: 'Crear Cuenta', error: 'Error al crear la cuenta.' });
  }
});

router.post('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

router.get('/recuperar', (req, res) => {
  res.render('auth/forgot-password', { title: 'Recuperar Contrasena', error: null, success: null });
});

router.post('/recuperar', async (req, res) => {
  const { email } = req.body;
  try {
    const { data: user } = await supabaseAdmin.from('users').select('id, email, full_name').eq('email', email.toLowerCase()).eq('is_active', true).single();
    const successMsg = 'Si ese email esta registrado, recibiras un enlace en unos minutos.';
    if (!user) return res.render('auth/forgot-password', { title: 'Recuperar Contrasena', error: null, success: successMsg });
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await supabaseAdmin.from('users').update({ reset_token: token, reset_token_expires: expires.toISOString() }).eq('id', user.id);
    const resetUrl = process.env.BASE_URL + '/auth/reset/' + token;
    await transporter.sendMail({
      from: '"Auto Premium Service" <' + process.env.EMAIL_USER + '>',
      to: user.email,
      subject: 'Recuperar contrasena - Auto Premium Service',
      html: '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem"><h2 style="color:#e63946">Auto Premium Service</h2><p>Hola ' + user.full_name + ',</p><p>Haz clic para restablecer tu contrasena:</p><a href="' + resetUrl + '" style="display:inline-block;background:#e63946;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin:1rem 0">Restablecer contrasena</a><p style="color:#888;font-size:0.85rem">Expira en 1 hora.</p></div>'
    });
    res.render('auth/forgot-password', { title: 'Recuperar Contrasena', error: null, success: successMsg });
  } catch (err) {
    console.error('Recuperar error:', err);
    res.render('auth/forgot-password', { title: 'Recuperar Contrasena', error: 'Error al procesar la solicitud.', success: null });
  }
});

router.get('/reset/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const { data: user } = await supabaseAdmin.from('users').select('id, reset_token_expires').eq('reset_token', token).single();
    if (!user || new Date(user.reset_token_expires) < new Date()) return res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'El enlace es invalido o ha expirado.', success: null, token: null });
    res.render('auth/reset-password', { title: 'Nueva Contrasena', error: null, success: null, token });
  } catch (err) {
    res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'Enlace invalido.', success: null, token: null });
  }
});

router.post('/reset/:token', async (req, res) => {
  const { token } = req.params;
  const { password, confirm_password } = req.body;
  if (password !== confirm_password) return res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'Las contrasenas no coinciden.', success: null, token });
  if (password.length < 6) return res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'Minimo 6 caracteres.', success: null, token });
  try {
    const { data: user } = await supabaseAdmin.from('users').select('id, reset_token_expires').eq('reset_token', token).single();
    if (!user || new Date(user.reset_token_expires) < new Date()) return res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'El enlace es invalido o ha expirado.', success: null, token: null });
    const password_hash = await bcrypt.hash(password, 12);
    await supabaseAdmin.from('users').update({ password_hash, reset_token: null, reset_token_expires: null }).eq('id', user.id);
    res.render('auth/reset-password', { title: 'Nueva Contrasena', error: null, success: 'Contrasena actualizada! Ya puedes iniciar sesion.', token: null });
  } catch (err) {
    res.render('auth/reset-password', { title: 'Nueva Contrasena', error: 'Error al actualizar.', success: null, token });
  }
});

module.exports = router;
