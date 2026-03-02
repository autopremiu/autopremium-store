const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');

// Search products
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  
  const { data } = await supabaseAdmin.from('products').select('id, name, slug, price, thumbnail').eq('is_active', true).ilike('name', `%${q}%`).limit(8);
  res.json(data || []);
});

// Apply coupon
router.post('/coupon', async (req, res) => {
  const { code, total } = req.body;
  const { data: coupon } = await supabaseAdmin.from('coupons').select('*').eq('code', code.toUpperCase()).eq('is_active', true).single();
  
  if (!coupon) return res.json({ success: false, message: 'Cupón inválido o expirado' });
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return res.json({ success: false, message: 'Cupón expirado' });
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) return res.json({ success: false, message: 'Cupón agotado' });
  if (total < coupon.min_order_amount) return res.json({ success: false, message: `Pedido mínimo: $${coupon.min_order_amount}` });

  const discount = coupon.type === 'percentage' ? (total * coupon.value / 100) : coupon.value;
  res.json({ success: true, discount, type: coupon.type, value: coupon.value });
});

// Check stock
router.get('/stock/:id', async (req, res) => {
  const { data: product } = await supabaseAdmin.from('products').select('stock').eq('id', req.params.id).single();
  res.json({ stock: product?.stock || 0 });
});

// ============================================
// WISHLIST
// ============================================

// Obtener IDs de wishlist del usuario (para marcar corazones al cargar la página)
router.get('/wishlist', requireAuth, async (req, res) => {
  const { data } = await supabaseAdmin
    .from('wishlists')
    .select('product_id')
    .eq('user_id', req.session.user.id);
  res.json({ success: true, items: (data || []).map(w => w.product_id) });
});

// Agregar o quitar de wishlist (toggle)
router.post('/wishlist/toggle', requireAuth, async (req, res) => {
  const { product_id } = req.body;
  const user_id = req.session.user.id;

  const { data: existing } = await supabaseAdmin
    .from('wishlists')
    .select('id')
    .eq('user_id', user_id)
    .eq('product_id', product_id)
    .single();

  if (existing) {
    await supabaseAdmin.from('wishlists').delete().eq('id', existing.id);
    res.json({ success: true, action: 'removed' });
  } else {
    await supabaseAdmin.from('wishlists').insert({ user_id, product_id });
    res.json({ success: true, action: 'added' });
  }
});

module.exports = router;