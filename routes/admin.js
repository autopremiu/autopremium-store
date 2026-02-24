const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

// Dashboard
router.get('/', async (req, res) => {
  const [ordersRes, productsRes, usersRes, revenueRes] = await Promise.all([
    supabaseAdmin.from('orders').select('id, status, total, created_at').order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('products').select('id, name, stock, price, is_active').order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('users').select('id', { count: 'exact' }).eq('role', 'customer'),
    supabaseAdmin.from('orders').select('total').eq('payment_status', 'paid')
  ]);

  const totalRevenue = (revenueRes.data || []).reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

  res.render('admin/dashboard', {
    title: 'Panel de Administración',
    recentOrders: ordersRes.data || [],
    recentProducts: productsRes.data || [],
    stats: {
      totalOrders: ordersRes.count || 0,
      totalUsers: usersRes.count || 0,
      totalRevenue,
      lowStock: (productsRes.data || []).filter(p => p.stock <= 5).length
    }
  });
});

// ============================================
// PRODUCTS ADMIN
// ============================================
router.get('/productos', async (req, res) => {
  const { page = 1, q } = req.query;
  const limit = 20;
  const offset = (page - 1) * limit;
  let query = supabaseAdmin.from('products').select('*, categories(name), brands(name)', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (q) query = query.ilike('name', `%${q}%`);
  const { data: products, count } = await query;
  res.render('admin/products', { title: 'Productos', products: products || [], total: count || 0, page: parseInt(page), totalPages: Math.ceil((count || 0) / limit), q });
});

router.get('/productos/nuevo', async (req, res) => {
  const [categoriesRes, brandsRes] = await Promise.all([
    supabaseAdmin.from('categories').select('*').eq('is_active', true),
    supabaseAdmin.from('brands').select('*').eq('is_active', true)
  ]);
  res.render('admin/product-form', { title: 'Nuevo Producto', product: null, categories: categoriesRes.data || [], brands: brandsRes.data || [], error: null });
});

router.post('/productos/nuevo', async (req, res) => {
  const { name, description, short_description, price, compare_price, stock, sku, category_id, brand_id, is_active, is_featured, thumbnail } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
  
  const { error } = await supabaseAdmin.from('products').insert({ name, slug, description, short_description, price: parseFloat(price), compare_price: compare_price ? parseFloat(compare_price) : null, stock: parseInt(stock), sku, category_id: category_id || null, brand_id: brand_id || null, is_active: is_active === 'on', is_featured: is_featured === 'on', thumbnail });
  
  if (error) {
    const [categoriesRes, brandsRes] = await Promise.all([supabaseAdmin.from('categories').select('*'), supabaseAdmin.from('brands').select('*')]);
    return res.render('admin/product-form', { title: 'Nuevo Producto', product: req.body, categories: categoriesRes.data || [], brands: brandsRes.data || [], error: error.message });
  }
  res.redirect('/admin/productos');
});

router.get('/productos/:id/editar', async (req, res) => {
  const [productRes, categoriesRes, brandsRes] = await Promise.all([
    supabaseAdmin.from('products').select('*').eq('id', req.params.id).single(),
    supabaseAdmin.from('categories').select('*').eq('is_active', true),
    supabaseAdmin.from('brands').select('*').eq('is_active', true)
  ]);
  if (!productRes.data) return res.redirect('/admin/productos');
  res.render('admin/product-form', { title: 'Editar Producto', product: productRes.data, categories: categoriesRes.data || [], brands: brandsRes.data || [], error: null });
});

router.post('/productos/:id/editar', async (req, res) => {
  const { name, description, short_description, price, compare_price, stock, sku, category_id, brand_id, is_active, is_featured, thumbnail } = req.body;
  await supabaseAdmin.from('products').update({ name, description, short_description, price: parseFloat(price), compare_price: compare_price ? parseFloat(compare_price) : null, stock: parseInt(stock), sku, category_id: category_id || null, brand_id: brand_id || null, is_active: is_active === 'on', is_featured: is_featured === 'on', thumbnail }).eq('id', req.params.id);
  res.redirect('/admin/productos');
});

router.post('/productos/:id/eliminar', async (req, res) => {
  await supabaseAdmin.from('products').update({ is_active: false }).eq('id', req.params.id);
  res.redirect('/admin/productos');
});

// ============================================
// ORDERS ADMIN
// ============================================
router.get('/pedidos', async (req, res) => {
  const { status, page = 1 } = req.query;
  const limit = 20;
  const offset = (page - 1) * limit;
  let query = supabaseAdmin.from('orders').select('*, users(full_name, email)', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (status) query = query.eq('status', status);
  const { data: orders, count } = await query;
  res.render('admin/orders', { title: 'Pedidos', orders: orders || [], total: count || 0, page: parseInt(page), totalPages: Math.ceil((count || 0) / limit), status });
});

router.get('/pedidos/:id', async (req, res) => {
  const { data: order } = await supabaseAdmin.from('orders').select('*, users(full_name, email, phone), order_items(*)').eq('id', req.params.id).single();
  if (!order) return res.redirect('/admin/pedidos');
  res.render('admin/order-detail', { title: `Pedido ${order.order_number}`, order });
});

router.post('/pedidos/:id/estado', async (req, res) => {
  const { status, tracking_number } = req.body;
  const updates = { status };
  if (tracking_number) updates.tracking_number = tracking_number;
  if (status === 'shipped') updates.shipped_at = new Date();
  if (status === 'delivered') updates.delivered_at = new Date();
  await supabaseAdmin.from('orders').update(updates).eq('id', req.params.id);
  res.redirect(`/admin/pedidos/${req.params.id}`);
});

// ============================================
// CATEGORIES ADMIN
// ============================================
router.get('/categorias', async (req, res) => {
  const { data: categories } = await supabaseAdmin.from('categories').select('*').order('sort_order');
  res.render('admin/categories', { title: 'Categorías', categories: categories || [] });
});

router.post('/categorias', async (req, res) => {
  const { name, description, icon } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await supabaseAdmin.from('categories').insert({ name, slug, description, icon });
  res.redirect('/admin/categorias');
});

// ============================================
// USERS ADMIN
// ============================================
router.get('/usuarios', async (req, res) => {
  const { data: users } = await supabaseAdmin.from('users').select('id, email, full_name, role, is_active, created_at').order('created_at', { ascending: false });
  res.render('admin/users', { title: 'Usuarios', users: users || [] });
});

module.exports = router;
