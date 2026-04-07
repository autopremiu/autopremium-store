const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const crypto = require('crypto');


// =============================
// MOSTRAR CHECKOUT
// =============================
router.get('/', requireAuth, async (req, res) => {

  const cart = req.session.cart;

  if (!cart || cart.items.length === 0) {
    return res.redirect('/cart');
  }

  const { data: addresses } = await supabaseAdmin
    .from('addresses')
    .select('*')
    .eq('user_id', req.session.user.id);

  res.render('shop/checkout', {
    title: 'Finalizar Compra',
    cart,
    addresses: addresses || []
  });

});


console.log("🚨 CREATE ORDER EJECUTÁNDOSE");

// =============================
// CREAR ORDEN + WOMPI
// =============================
router.post('/create-order', requireAuth, async (req, res) => {

  const cart = req.session.cart;

  if (!cart || cart.items.length === 0) {
    return res.json({ error: 'Carrito vacío' });
  }

  try {

    // ✅ PRODUCTO + ENVÍO
    const subtotal = cart.items.reduce((acc, item) => {
      return acc + (Number(item.price) * Number(item.quantity));
    }, 0);
    const shipping_cost = 20000; // 👈 ENVÍO FIJO
    const total = subtotal + shipping_cost; // 👈 TOTAL REAL

    const referenceCode = `ORDER-${Date.now()}`;

    // =============================
    // GUARDAR ORDEN
    // =============================
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: req.session.user.id,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'wompi',
        subtotal: subtotal,
        shipping_cost: shipping_cost,
        tax: 0,
        discount: 0,
        total: total,
        shipping_address: req.body.shipping_address,
        notes: "Pago completo con envío incluido", // 👈 CORREGIDO
        reference_code: referenceCode
      })
      .select()
      .single();

    if (error) throw error;

    // =============================
    // WOMPI
    // =============================
    const amountInCents = Math.round(total * 100);

    const integrityString = `${referenceCode}${amountInCents}COP${process.env.WOMPI_INTEGRITY_KEY}`;

    const integritySignature = crypto
      .createHash("sha256")
      .update(integrityString)
      .digest("hex");

    // ✅ URL SIN ERRORES (IMPORTANTE)
    const params = new URLSearchParams({
      'public-key': process.env.WOMPI_PUBLIC_KEY,
      currency: 'COP',
      'amount-in-cents': amountInCents,
      reference: referenceCode,
      'signature:integrity': integritySignature,
      'redirect-url': `${process.env.BASE_URL}/checkout/confirmacion/${referenceCode}`
    });

    const checkoutUrl = `https://checkout.wompi.co/p/?${params.toString()}`;

    res.json({
      checkout_url: checkoutUrl
    });

  } catch (err) {
    console.error('Create order error:', err.message);
    res.json({
      error: 'Error creando la orden'
    });
  }

});

module.exports = router;