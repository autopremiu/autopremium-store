// ============================================
// AUTO PREMIUM SERVICE - MAIN JS
// ============================================

// Cart Notification
function showCartNotification(msg) {
  const el = document.getElementById('cartNotification');
  const msgEl = document.getElementById('cartNotificationMsg');
  if (!el) return;
  msgEl.textContent = msg || 'Producto agregado al carrito';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// Add to Cart buttons
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-add-cart');
  if (!btn || btn.id === 'addCartBtn') return; // product detail has its own handler
  
  const id = btn.dataset.id;
  const name = btn.dataset.name;
  if (!id) return;

  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

  try {
    const res = await fetch('/cart/agregar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: id, quantity: 1 })
    });
    const data = await res.json();

    if (data.success) {
      const countEl = document.getElementById('cartCount');
      if (countEl) countEl.textContent = data.cart.count;
      showCartNotification(`"${name}" agregado al carrito`);
      btn.innerHTML = '<i class="fas fa-check"></i> Agregado';
      setTimeout(() => { btn.innerHTML = originalHTML; btn.disabled = false; }, 2000);
    } else {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      showCartNotification(data.message || 'Error al agregar');
    }
  } catch (err) {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
});

// Search suggestions
const searchInput = document.getElementById('searchInput');
const suggestions = document.getElementById('searchSuggestions');

if (searchInput && suggestions) {
  let timeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(timeout);
    const q = searchInput.value.trim();
    if (q.length < 2) { suggestions.style.display = 'none'; return; }

    timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.length === 0) { suggestions.style.display = 'none'; return; }

        suggestions.innerHTML = data.map(p => `
          <a href="/producto/${p.slug}" class="search-suggestion-item">
            ${p.thumbnail ? `<img src="${p.thumbnail}" alt="">` : '<div style="width:36px;height:36px;background:var(--dark4);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:1rem">⚙️</div>'}
            <div>
              <div style="font-size:0.9rem;font-weight:600">${p.name}</div>
              <div style="font-size:0.8rem;color:var(--text-muted)">$${Number(p.price).toLocaleString('es-CO')}</div>
            </div>
          </a>
        `).join('');
        suggestions.style.display = 'block';
      } catch {}
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-search')) suggestions.style.display = 'none';
  });
}

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => navMenu.classList.toggle('open'));
}
