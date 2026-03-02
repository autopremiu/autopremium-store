const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Dashboard
router.get('/', async (req, res) => {
  const { data: orders } = await supabaseAdmin.from('orders').select('*').eq('user_id', req.session.user.id).order('created_at', { ascending: false }).limit(5);
  res.render('account/dashboard', { title: 'Mi Cuenta', orders: orders || [] });
});

// Orders
router.get('/pedidos', async (req, res) => {
  const { data: orders } = await supabaseAdmin.from('orders').select('*, order_items(*)').eq('user_id', req.session.user.id).order('created_at', { ascending: false });
  res.render('account/orders', { title: 'Mis Pedidos', orders: orders || [] });
});

// Order detail
router.get('/pedidos/:order_number', async (req, res) => {
  const { data: order } = await supabaseAdmin.from('orders').select('*, order_items(*)').eq('order_number', req.params.order_number).eq('user_id', req.session.user.id).single();
  if (!order) return res.redirect('/account/pedidos');
  res.render('account/order-detail', { title: `Pedido ${order.order_number}`, order });
});

// Profile
router.get('/perfil', (req, res) => {
  res.render('account/profile', { title: 'Mi Perfil', error: null, success: null });
});

router.post('/perfil', async (req, res) => {
  const { full_name, phone } = req.body;
  try {
    await supabaseAdmin.from('users').update({ full_name, phone }).eq('id', req.session.user.id);
    req.session.user.full_name = full_name;
    res.render('account/profile', { title: 'Mi Perfil', error: null, success: 'Perfil actualizado' });
  } catch {
    res.render('account/profile', { title: 'Mi Perfil', error: 'Error al actualizar', success: null });
  }
});

// Addresses
router.get('/direcciones', async (req, res) => {
  const { data: addresses } = await supabaseAdmin.from('addresses').select('*').eq('user_id', req.session.user.id);
  res.render('account/addresses', { title: 'Mis Direcciones', addresses: addresses || [] });
});

router.post('/direcciones', async (req, res) => {
  const addr = { ...req.body, user_id: req.session.user.id };
  await supabaseAdmin.from('addresses').insert(addr);
  res.redirect('/account/direcciones');
});

router.post('/direcciones/:id/eliminar', async (req, res) => {
  await supabaseAdmin.from('addresses').delete().eq('id', req.params.id).eq('user_id', req.session.user.id);
  res.redirect('/account/direcciones');
});

// Wishlist
router.get('/favoritos', async (req, res) => {
  const { data } = await supabaseAdmin
    .from('wishlists')
    .select('product_id, products(id, name, slug, price, compare_price, thumbnail, rating, review_count, brands(name))')
    .eq('user_id', req.session.user.id)
    .order('created_at', { ascending: false });

  const products = (data || []).map(w => w.products).filter(Boolean);
  res.render('account/wishlist', { title: 'Mis Favoritos', products });
});

module.exports = router;