const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { sendOrderNotificationAdmin, sendOrderConfirmationClient } = require('../config/email');

// GET Checkout
router.get('/', requireAuth, async (req, res) => {
  const cart = req.session.cart;
  if (!cart || cart.items.length === 0) return res.redirect('/cart');
  const { data: addresses } = await supabaseAdmin.from('addresses').select('*').eq('user_id', req.session.user.id);
  res.render('shop/checkout', { title: 'Finalizar Compra', cart, addresses: addresses || [], stripePK: process.env.STRIPE_PUBLISHABLE_KEY });
});

router.post('/crear-pago', requireAuth, async (req, res) => {
  const cart = req.session.cart;
  if (!cart || cart.items.length === 0) return res.json({ error: 'Carrito vacío' });
  try {
    const paymentIntent = await stripe.paymentIntents.create({ amount: Math.round(cart.total * 100), currency: 'cop', metadata: { user_id: req.session.user.id } });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.json({ error: 'Error al crear el pago' });
  }
});

router.post('/confirmar', requireAuth, async (req, res) => {
  const { shipping_address, payment_intent_id, notes } = req.body;
  const cart = req.session.cart;
  if (!cart || cart.items.length === 0) return res.json({ success: false, message: 'Carrito vacío' });
  try {
    let paymentStatus = 'pending';
    if (payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(payment_intent_id);
      paymentStatus = pi.status === 'succeeded' ? 'paid' : 'pending';
    }
    const shippingAddr = JSON.parse(shipping_address);
    const { data: order, error } = await supabaseAdmin.from('orders').insert({
      user_id: req.session.user.id,
      status: paymentStatus === 'paid' ? 'confirmed' : 'pending',
      payment_status: paymentStatus,
      payment_method: 'stripe',
      stripe_payment_intent_id: payment_intent_id,
      subtotal: cart.subtotal, shipping_cost: 0, tax: 0, discount: 0, total: cart.total,
      shipping_address: shippingAddr, notes
    }).select().single();
    if (error) throw error;
    await supabaseAdmin.from('order_items').insert(cart.items.map(item => ({
      order_id: order.id, product_id: item.id, product_name: item.name,
      product_sku: item.sku, product_image: item.thumbnail,
      quantity: item.quantity, unit_price: item.price, total_price: item.price * item.quantity
    })));

    // Descontar stock y actualizar sold_count por cada producto
    await Promise.all(cart.items.map(async (item) => {
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('stock, sold_count')
        .eq('id', item.id)
        .single();
      if (product) {
        await supabaseAdmin.from('products').update({
          stock: Math.max(0, product.stock - item.quantity),
          sold_count: (product.sold_count || 0) + item.quantity
        }).eq('id', item.id);
      }
    }));
    const { data: fullOrder } = await supabaseAdmin.from('orders').select('*, order_items(*)').eq('id', order.id).single();
    const { data: userData } = await supabaseAdmin.from('users').select('email').eq('id', req.session.user.id).single();
    if (fullOrder) {
      sendOrderNotificationAdmin(fullOrder).catch(() => {});
      if (userData?.email) sendOrderConfirmationClient(fullOrder, userData.email).catch(() => {});
    }
    req.session.cart = { items: [], count: 0, subtotal: 0, total: 0 };
    res.json({ success: true, order_number: order.order_number, order_id: order.id });
  } catch (err) {
    console.error('Order error:', err);
    res.json({ success: false, message: 'Error al procesar el pedido' });
  }
});

router.get('/confirmacion/:order_number', requireAuth, async (req, res) => {
  const { data: order } = await supabaseAdmin.from('orders').select('*, order_items(*)').eq('order_number', req.params.order_number).eq('user_id', req.session.user.id).single();
  if (!order) return res.redirect('/');
  res.render('shop/order-confirmation', { title: 'Pedido Confirmado', order });
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }
  if (event.type === 'payment_intent.succeeded') {
    await supabaseAdmin.from('orders').update({ payment_status: 'paid', status: 'confirmed' }).eq('stripe_payment_intent_id', event.data.object.id);
  }
  res.json({ received: true });
});

module.exports = router;