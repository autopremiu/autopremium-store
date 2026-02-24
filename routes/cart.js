const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// Helper: recalculate cart totals
function recalcCart(cart) {
  cart.count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  cart.subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  cart.total = cart.subtotal;
  return cart;
}

// View cart
router.get('/', (req, res) => {
  const cart = req.session.cart || { items: [], count: 0, subtotal: 0, total: 0 };
  res.render('shop/cart', { title: 'Carrito de Compras', cart });
});

// Add to cart
router.post('/agregar', async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  try {
    const { data: product } = await supabaseAdmin.from('products').select('id, name, slug, price, thumbnail, stock, sku').eq('id', product_id).eq('is_active', true).single();
    
    if (!product) return res.json({ success: false, message: 'Producto no encontrado' });
    if (product.stock < 1) return res.json({ success: false, message: 'Producto sin stock' });

    if (!req.session.cart) req.session.cart = { items: [], count: 0, subtotal: 0, total: 0 };
    const cart = req.session.cart;

    const existing = cart.items.find(i => i.id === product.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + parseInt(quantity), product.stock);
    } else {
      cart.items.push({ id: product.id, name: product.name, slug: product.slug, price: product.price, thumbnail: product.thumbnail, sku: product.sku, quantity: parseInt(quantity), stock: product.stock });
    }

    recalcCart(cart);
    req.session.cart = cart;

    res.json({ success: true, message: 'Producto agregado al carrito', cart: { count: cart.count, total: cart.total } });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Error al agregar producto' });
  }
});

// Update quantity
router.post('/actualizar', (req, res) => {
  const { product_id, quantity } = req.body;
  const cart = req.session.cart || { items: [] };
  const item = cart.items.find(i => i.id === product_id);
  
  if (item) {
    if (parseInt(quantity) <= 0) {
      cart.items = cart.items.filter(i => i.id !== product_id);
    } else {
      item.quantity = Math.min(parseInt(quantity), item.stock);
    }
    recalcCart(cart);
    req.session.cart = cart;
  }
  res.json({ success: true, cart: { count: cart.count, total: cart.total, subtotal: cart.subtotal, items: cart.items } });
});

// Remove item
router.post('/eliminar', (req, res) => {
  const { product_id } = req.body;
  const cart = req.session.cart || { items: [] };
  cart.items = cart.items.filter(i => i.id !== product_id);
  recalcCart(cart);
  req.session.cart = cart;
  res.json({ success: true, cart: { count: cart.count, total: cart.total } });
});

// Clear cart
router.post('/vaciar', (req, res) => {
  req.session.cart = { items: [], count: 0, subtotal: 0, total: 0 };
  res.json({ success: true });
});

module.exports = router;
