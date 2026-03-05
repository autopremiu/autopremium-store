const express = require('express');
const router = express.Router(); // <--- ESTO ES LO QUE TE FALTABA
const { supabaseAdmin } = require('../config/supabase'); // Asegúrate de que la ruta a tu config sea correcta
const { requireAuth } = require('../middleware/auth'); // Asegúrate de que la ruta a tu middleware sea correcta
const crypto = require('crypto');

router.post('/create-order', requireAuth, async (req, res) => {
  const cart = req.session.cart;

  if (!cart || cart.items.length === 0) {
    return res.json({ error: 'Carrito vacío' });
  }

  try {
    const FREE_SHIPPING_MIN = 150000;
    const SHIPPING_COST = 10000;

    const subtotal = Number(cart.subtotal);
    const shipping_cost = subtotal >= FREE_SHIPPING_MIN ? 0 : SHIPPING_COST;
    const total = subtotal + shipping_cost;

    const referenceCode = `ORDER-${Date.now()}`;

    // 1. Guardar en Supabase
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
        notes: req.body.notes,
        reference_code: referenceCode
      })
      .select()
      .single();

    if (error) throw error;

    // ==========================
    // 🔹 CONFIGURACIÓN WOMPI
    // ==========================

    const amountInCents = Math.round(total * 100);

    // La firma de integridad es vital para que Wompi acepte el pago
    const integrityString = `${referenceCode}${amountInCents}COP${process.env.WOMPI_INTEGRITY_KEY}`;

    const integritySignature = crypto
      .createHash("sha256")
      .update(integrityString)
      .digest("hex");

    const checkoutUrl =
      `https://checkout.wompi.co/p/?public-key=${process.env.WOMPI_PUBLIC_KEY}` +
      `&currency=COP` +
      `&amount-in-cents=${amountInCents}` +
      `&reference=${referenceCode}` +
      `&signature:integrity=${integritySignature}` +
      `&redirect-url=${process.env.BASE_URL}/checkout/confirmacion/${referenceCode}`;

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

// ¡MUY IMPORTANTE! Exportar el router para que server.js lo pueda usar
module.exports = router;