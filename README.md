# 🚗 Auto Premium Service - E-commerce

Tienda virtual de repuestos automotrices construida con Node.js + Express + EJS + Supabase + Stripe.

## 🛠️ Stack Tecnológico

- **Backend**: Node.js + Express.js
- **Frontend**: EJS templates + CSS + Vanilla JS
- **Base de Datos**: Supabase (PostgreSQL)
- **Pagos**: Stripe
- **Deploy**: Render

---

## 🚀 Configuración Inicial

### 1. Clonar y instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL de tu proyecto en Supabase |
| `SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `SUPABASE_SERVICE_KEY` | Clave de servicio de Supabase (roles) |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe (sk_...) |
| `STRIPE_PUBLISHABLE_KEY` | Clave pública de Stripe (pk_...) |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook de Stripe |
| `SESSION_SECRET` | Clave secreta para sesiones (any string) |

### 3. Configurar Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto
2. En el **SQL Editor**, ejecuta todo el contenido de `config/schema.sql`
3. Copia las credenciales en tu `.env`

### 4. Configurar Stripe

1. Ve a [stripe.com](https://stripe.com) y crea una cuenta
2. Copia tus claves de **modo prueba** en `.env`
3. Para webhooks locales, usa [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/checkout/webhook
   ```

### 5. Crear el admin inicial

Registra una cuenta normalmente en `/auth/registro`, luego en Supabase ejecuta:
```sql
UPDATE users SET role = 'admin' WHERE email = 'tu@email.com';
```

---

## 🏃‍♂️ Ejecutar localmente

```bash
npm run dev    # Con nodemon (auto-reload)
npm start      # Producción
```

Visita: http://localhost:3000

---

## ☁️ Deploy en Render

1. Sube el proyecto a GitHub
2. En [render.com](https://render.com):
   - New → Web Service
   - Conecta tu repositorio
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: Node
3. Agrega todas las variables de entorno desde tu `.env`
4. Deploy! 🎉

---

## 📁 Estructura del Proyecto

```
autopremium/
├── config/
│   ├── supabase.js          # Cliente Supabase
│   └── schema.sql           # Schema de BD (ejecutar en Supabase)
├── middleware/
│   └── auth.js              # Autenticación/autorización
├── routes/
│   ├── shop.js              # Tienda pública
│   ├── auth.js              # Login/Registro
│   ├── cart.js              # Carrito
│   ├── checkout.js          # Checkout + Stripe
│   ├── account.js           # Cuenta del usuario
│   ├── admin.js             # Panel administrador
│   └── api.js               # API AJAX
├── views/
│   ├── partials/            # Header, footer, product-cards
│   ├── shop/                # Tienda: home, products, cart, checkout
│   ├── auth/                # Login, registro
│   ├── account/             # Dashboard, pedidos, perfil
│   └── admin/               # Panel de administración
├── public/
│   ├── css/main.css         # Estilos
│   ├── js/main.js           # JavaScript
│   └── images/              # Logo y estáticos
├── server.js                # Servidor principal
├── package.json
└── .env.example
```

---

## 🔒 Seguridad

- Contraseñas hasheadas con bcrypt (12 rounds)
- Sesiones con cookies HTTP-only
- Validación de roles en todas las rutas admin
- Verificación de pagos con Stripe webhooks

---

## 💡 Funcionalidades

- ✅ Catálogo con filtros por categoría, marca y precio
- ✅ Búsqueda en tiempo real con sugerencias
- ✅ Carrito de compras persistente (session)
- ✅ Registro e inicio de sesión
- ✅ Checkout completo con Stripe
- ✅ Panel de administración (productos, pedidos, categorías, usuarios)
- ✅ Gestión de direcciones de envío
- ✅ Historial de pedidos
- ✅ Cupones de descuento
- ✅ Diseño responsive
