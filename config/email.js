const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'comercialautopremium@gmail.com',
    pass: process.env.EMAIL_PASS // App Password de Gmail
  }
});

// Email: nuevo pedido para el admin
async function sendOrderNotificationAdmin(order) {
  try {
    const itemsList = order.order_items?.map(i =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #333">${i.product_name}</td>
        <td style="padding:8px;border-bottom:1px solid #333;text-align:center">${i.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #333;text-align:right">$${Number(i.total_price).toLocaleString('es-CO')}</td>
      </tr>`
    ).join('') || '';

    await transporter.sendMail({
      from: `"Auto Premium Service" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_ADMIN || 'comercialautopremium@gmail.com',
      subject: `🛒 Nuevo Pedido #${order.order_number} - $${Number(order.total).toLocaleString('es-CO')}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#111;color:#e8e8e8;border-radius:8px;overflow:hidden">
          <div style="background:#e63946;padding:20px;text-align:center">
            <h1 style="margin:0;color:white;font-size:24px">🚗 AUTO PREMIUM SERVICE</h1>
            <p style="margin:5px 0 0;color:rgba(255,255,255,0.8)">Nuevo pedido recibido</p>
          </div>
          <div style="padding:30px">
            <h2 style="color:#e63946">Pedido #${order.order_number}</h2>
            <p><strong>Total:</strong> $${Number(order.total).toLocaleString('es-CO')}</p>
            <p><strong>Estado pago:</strong> ${order.payment_status}</p>
            <p><strong>Cliente:</strong> ${order.shipping_address?.full_name}</p>
            <p><strong>Dirección:</strong> ${order.shipping_address?.address_line1}, ${order.shipping_address?.city}</p>
            <p><strong>Teléfono:</strong> ${order.shipping_address?.phone || 'N/A'}</p>
            <h3 style="margin-top:20px">Productos:</h3>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#1a1a1a">
                  <th style="padding:8px;text-align:left">Producto</th>
                  <th style="padding:8px;text-align:center">Cant.</th>
                  <th style="padding:8px;text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>${itemsList}</tbody>
            </table>
            <div style="margin-top:20px;text-align:center">
              <a href="${process.env.APP_URL}/admin/pedidos" style="background:#e63946;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Ver en el Admin</a>
            </div>
          </div>
        </div>
      `
    });
    console.log('✅ Email admin enviado');
  } catch (err) {
    console.error('❌ Error email admin:', err.message);
  }
}

// Email: confirmación para el cliente
async function sendOrderConfirmationClient(order, userEmail) {
  try {
    const itemsList = order.order_items?.map(i =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${i.product_name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">$${Number(i.total_price).toLocaleString('es-CO')}</td>
      </tr>`
    ).join('') || '';

    await transporter.sendMail({
      from: `"Auto Premium Service" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `✅ Pedido confirmado #${order.order_number} - Auto Premium Service`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:8px;overflow:hidden">
          <div style="background:#e63946;padding:20px;text-align:center">
            <h1 style="margin:0;color:white">🚗 AUTO PREMIUM SERVICE</h1>
          </div>
          <div style="padding:30px;background:white">
            <h2 style="color:#e63946">¡Gracias por tu compra!</h2>
            <p>Hola <strong>${order.shipping_address?.full_name}</strong>, tu pedido ha sido recibido y está siendo procesado.</p>
            <div style="background:#f5f5f5;padding:15px;border-radius:6px;margin:20px 0">
              <p style="margin:0"><strong>Pedido #:</strong> ${order.order_number}</p>
              <p style="margin:5px 0 0"><strong>Total:</strong> $${Number(order.total).toLocaleString('es-CO')}</p>
            </div>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f5f5f5">
                  <th style="padding:8px;text-align:left">Producto</th>
                  <th style="padding:8px;text-align:center">Cant.</th>
                  <th style="padding:8px;text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>${itemsList}</tbody>
            </table>
            <p style="margin-top:20px;color:#666">¿Tienes dudas? Escríbenos a <a href="mailto:comercialautopremium@gmail.com">comercialautopremium@gmail.com</a> o por WhatsApp.</p>
          </div>
          <div style="background:#111;padding:15px;text-align:center;color:#888;font-size:12px">
            © 2026 Auto Premium Service. Todos los derechos reservados.
          </div>
        </div>
      `
    });
    console.log('✅ Email cliente enviado');
  } catch (err) {
    console.error('❌ Error email cliente:', err.message);
  }
}

// Email: recuperación de contraseña
async function sendPasswordResetEmail(user, resetUrl) {
  try {
    await transporter.sendMail({
      from: `"Auto Premium Service" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: '🔐 Restablecer contraseña - Auto Premium Service',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;border-radius:8px;overflow:hidden">
          <div style="background:#e63946;padding:20px;text-align:center">
            <h1 style="margin:0;color:white">🚗 AUTO PREMIUM SERVICE</h1>
          </div>
          <div style="padding:30px;background:white">
            <h2 style="color:#e63946">Restablecer contraseña</h2>
            <p>Hola <strong>${user.full_name}</strong>,</p>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para continuar:</p>
            <div style="text-align:center;margin:30px 0">
              <a href="${resetUrl}" style="background:#e63946;color:white;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">
                Restablecer Contraseña
              </a>
            </div>
            <p style="color:#666;font-size:14px">Este enlace expira en <strong>1 hora</strong>. Si no solicitaste restablecer tu contraseña, ignora este mensaje.</p>
            <p style="color:#999;font-size:12px;word-break:break-all">Si el botón no funciona, copia este enlace en tu navegador:<br>${resetUrl}</p>
          </div>
          <div style="background:#111;padding:15px;text-align:center;color:#888;font-size:12px">
            © 2026 Auto Premium Service. Todos los derechos reservados.
          </div>
        </div>
      `
    });
    console.log('✅ Email reset enviado');
  } catch (err) {
    console.error('❌ Error email reset:', err.message);
  }
}

module.exports = { sendOrderNotificationAdmin, sendOrderConfirmationClient, sendPasswordResetEmail };