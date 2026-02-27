const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');

// Home page
router.get('/', async (req, res) => {
  try {
    const [featuredRes, categoriesRes, brandsRes, bannersRes] = await Promise.all([
      supabaseAdmin.from('products').select('*, categories(name, slug), brands(name)').eq('is_active', true).eq('is_featured', true).limit(8),
      supabaseAdmin.from('categories').select('*').eq('is_active', true).order('sort_order'),
      supabaseAdmin.from('brands').select('*').eq('is_active', true).limit(10),
      supabaseAdmin.from('banners').select('*').eq('is_active', true).order('sort_order').limit(5)
    ]);

    res.render('shop/home', {
      title: 'Auto Premium Service - Repuestos Automotrices',
      featured: featuredRes.data || [],
      categories: categoriesRes.data || [],
      brands: brandsRes.data || [],
      banners: bannersRes.data || []
    });
  } catch (err) {
    console.error(err);
    res.render('shop/home', { title: 'Auto Premium Service', featured: [], categories: [], brands: [], banners: [] });
  }
});

// Products listing
router.get('/productos', async (req, res) => {
  try {
    const { q, categoria, marca, min, max, orden, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin.from('products').select('*, categories(name, slug), brands(name)', { count: 'exact' }).eq('is_active', true);

    if (q) query = query.ilike('name', `%${q}%`);
    if (categoria) query = query.eq('categories.slug', categoria);
    if (marca) query = query.eq('brands.slug', marca);
    if (min) query = query.gte('price', min);
    if (max) query = query.lte('price', max);

    switch (orden) {
      case 'precio-asc': query = query.order('price', { ascending: true }); break;
      case 'precio-desc': query = query.order('price', { ascending: false }); break;
      case 'nombre': query = query.order('name'); break;
      default: query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: products, count, error } = await query;

    const [categoriesRes, brandsRes] = await Promise.all([
      supabaseAdmin.from('categories').select('*').eq('is_active', true),
      supabaseAdmin.from('brands').select('*').eq('is_active', true)
    ]);

    res.render('shop/products', {
      title: q ? `Resultados: "${q}"` : 'Catálogo de Repuestos',
      products: products || [],
      categories: categoriesRes.data || [],
      brands: brandsRes.data || [],
      banners: bannersRes.data || [],
      total: count || 0,
      page: parseInt(page),
      totalPages: Math.ceil((count || 0) / limit),
      filters: { q, categoria, marca, min, max, orden }
    });
  } catch (err) {
    console.error(err);
    res.render('shop/products', { title: 'Catálogo', products: [], categories: [], brands: [], total: 0, page: 1, totalPages: 0, filters: {} });
  }
});

// Single product
router.get('/producto/:slug', async (req, res) => {
  try {
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*, categories(name, slug), brands(name, logo_url)')
      .eq('slug', req.params.slug)
      .eq('is_active', true)
      .single();

    if (error || !product) return res.status(404).render('404', { title: 'Producto no encontrado' });

    const { data: related } = await supabaseAdmin
      .from('products')
      .select('id, name, slug, price, compare_price, thumbnail, rating')
      .eq('category_id', product.category_id)
      .eq('is_active', true)
      .neq('id', product.id)
      .limit(4);

    const { data: reviews } = await supabaseAdmin
      .from('reviews')
      .select('*, users(full_name)')
      .eq('product_id', product.id)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(5);

    res.render('shop/product-detail', {
      title: product.name,
      product,
      related: related || [],
      reviews: reviews || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Error', message: 'Error al cargar el producto' });
  }
});

// Category page
router.get('/categoria/:slug', async (req, res) => {
  try {
    const { data: category } = await supabaseAdmin.from('categories').select('*').eq('slug', req.params.slug).single();
    if (!category) return res.status(404).render('404', { title: 'Categoría no encontrada' });

    const { data: products } = await supabaseAdmin
      .from('products')
      .select('*, brands(name)')
      .eq('category_id', category.id)
      .eq('is_active', true)
      .order('is_featured', { ascending: false });

    res.redirect(`/productos?categoria=${req.params.slug}`);
  } catch (err) {
    res.redirect('/productos');
  }
});

module.exports = router;
