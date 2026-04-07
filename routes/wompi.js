const express = require("express");
const crypto = require("crypto");

const router = express.Router();

// 🔐 firma
function generarFirma(referencia, monto, moneda, integrityKey) {
  const cadena = `${referencia}${monto}${moneda}${integrityKey}`;

  return crypto
    .createHash("sha256")
    .update(cadena)
    .digest("hex");
}

// 💳 crear pago + pedido
router.post("/wompi", async (req, res) => {
  try {
    const { monto, email } = req.body;

    const referencia = "ORD-" + Date.now();
    const currency = "COP";

    // 👉 AQUÍ GUARDAS EL PEDIDO (ejemplo simple)
    console.log("🧾 Pedido creado:", referencia);

    // 👉 firma
    const firma = generarFirma(
      referencia,
      monto,
      currency,
      process.env.WOMPI_INTEGRITY_KEY
    );

    res.json({
      publicKey: process.env.WOMPI_PUBLIC_KEY,
      referencia,
      monto,
      currency,
      firma
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en pago" });
  }
});

router.post("/webhook/wompi", (req, res) => {
  try {
    const evento = req.body;

    console.log("📩 WEBHOOK WOMPI:", evento);

    const transaccion = evento.data.transaction;

    const referencia = transaccion.reference;
    const estado = transaccion.status;

    if (estado === "APPROVED") {
      console.log("✅ PAGO APROBADO:", referencia);

      // 👉 aquí actualizas en tu DB:
      // estado = PAGADO
    }

    if (estado === "DECLINED") {
      console.log("❌ PAGO RECHAZADO:", referencia);
    }

    res.sendStatus(200);

  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

module.exports = router;