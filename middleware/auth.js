// Middleware: require login
const requireAuth = (req, res, next) => {
  if (!req.session.user) {

    // Si es una petición API (fetch / ajax)
    if (req.originalUrl.startsWith('/api')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Si es una vista normal
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }

  next();
};

// Middleware: require admin
const requireAdmin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('error', { 
      title: 'Acceso denegado',
      message: 'No tienes permisos para acceder a esta página.'
    });
  }
  next();
};

// Middleware: redirect if already logged in
const redirectIfAuth = (req, res, next) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  next();
};

module.exports = { requireAuth, requireAdmin, redirectIfAuth };
