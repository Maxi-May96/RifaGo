export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  if (req.xhr || req.headers.accept?.includes('json')) {
    return res.status(403).json({ success: false, message: 'Acceso denegado: Se requiere rol de administrador' });
  }
  
  // If not admin, block with a 403 response rendering the error page
  return res.status(403).render('errors/404', { 
    title: 'Acceso Denegado - RifaGo', 
    layout: false 
  });
};
