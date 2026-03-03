const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { sendOrderNotificationAdmin, sendOrderConfirmationClient } = require('../config/email');


// =============================
// GET CHECKOUT
// =============================
router.get('/', requireAuth, async (req, res) => {
  const cart = req.session.cart;
  if (!cart || cart.items.length === 0) return res.redirect('/cart');

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


// =============================
// INICIAR PAGO PAYU
// =============================
router.post('/payu', requireAuth, async (req, res) => {
  const cart = req.session.cart;

  if (!cart || cart.items.length === 0)
    return res.json({ error: 'Carrito vacío' });

  try {
    const referenceCode = `ORDER-${Date.now()}`;
    const amount = Number(cart.total).toFixed(2);
    const currency = 'COP';

    // 🔹 Crear orden PENDING
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: req.session.user.id,
        status: 'pending',
        payment_status: 'pending',
        payment_method: 'payu',
        subtotal: cart.subtotal,
        shipping_cost: 0,
        tax: 0,
        discount: 0,
        total: cart.total,
        shipping_address: req.body.shipping_address,
        notes: req.body.notes,
        reference_code: referenceCode
      })
      .select()
      .single();

    if (error) throw error;

    // 🔹 Firma PayU
    const signatureString =
      `${process.env.PAYU_API_KEY}~${process.env.PAYU_MERCHANT_ID}~${referenceCode}~${amount}~${currency}`;

    const signature = crypto
      .createHash('md5')
      .update(signatureString)
      .digest('hex');

    const form = `
      <form method="POST" action="https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/">
        <input name="merchantId" value="${process.env.PAYU_MERCHANT_ID}" />
        <input name="accountId" value="${process.env.PAYU_ACCOUNT_ID}" />
        <input name="description" value="Compra Autopremium" />
        <input name="referenceCode" value="${referenceCode}" />
        <input name="amount" value="${amount}" />
        <input name="tax" value="0" />
        <input name="taxReturnBase" value="0" />
        <input name="currency" value="${currency}" />
        <input name="signature" value="${signature}" />
        <input name="test" value="1" />
        <input name="buyerEmail" value="${req.session.user.email}" />
        <input name="responseUrl" value="https://TU_DOMINIO.com/checkout/confirmacion/${referenceCode}" />
        <input name="confirmationUrl" value="https://TU_DOMINIO.com/checkout/payu-confirmacion" />
      </form>
    `;

    res.json({ form });

  } catch (err) {
    console.error('PayU init error:', err.message);
    res.json({ error: 'Error iniciando pago PayU' });
  }
});


// =============================
// WEBHOOK PAYU (SIN SESSION)
// =============================
router.post('/payu-confirmacion', async (req, res) => {
  try {
    const {
      reference_sale,
      state_pol,
      value,
      currency,
      sign
    } = req.body;

    const signatureString =
      `${process.env.PAYU_API_KEY}~${process.env.PAYU_MERCHANT_ID}~${reference_sale}~${value}~${currency}~${state_pol}`;

    const localSignature = crypto
      .createHash('md5')
      .update(signatureString)
      .digest('hex');

    if (localSignature !== sign) {
      console.log('Firma inválida PayU');
      return res.sendStatus(400);
    }

    if (state_pol == 4) {

      const { data: order } = await supabaseAdmin
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed'
        })
        .eq('reference_code', reference_sale)
        .select()
        .single();

      if (order) {

        const { data: items } = await supabaseAdmin
          .from('order_items')
          .select('*')
          .eq('order_id', order.id);

        if (items) {
          await Promise.all(items.map(async (item) => {
            const { data: product } = await supabaseAdmin
              .from('products')
              .select('stock, sold_count')
              .eq('id', item.product_id)
              .single();

            if (product) {
              await supabaseAdmin.from('products').update({
                stock: Math.max(0, product.stock - item.quantity),
                sold_count: (product.sold_count || 0) + item.quantity
              }).eq('id', item.product_id);
            }
          }));
        }

        sendOrderNotificationAdmin(order).catch(() => {});
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.error('PayU confirm error:', err.message);
    res.sendStatus(500);
  }
});


// =============================
// CONFIRMACION VISTA
// =============================
router.get('/confirmacion/:reference_code', requireAuth, async (req, res) => {

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .eq('reference_code', req.params.reference_code)
    .eq('user_id', req.session.user.id)
    .single();

  if (!order) return res.redirect('/');

  res.render('shop/order-confirmation', {
    title: 'Pedido Confirmado',
    order
  });
});

module.exports = router;