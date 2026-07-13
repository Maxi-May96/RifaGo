import User from '../models/User.js';

// Renders the User Profile page
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.render('user/profile', {
      title: 'Mi Perfil - RifaGo',
      user,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Error on getProfile:', error);
    res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
  }
};

// Handles profile updates and file uploads
export const updateProfile = async (req, res) => {
  const { name, phone, age, description } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.redirect('/auth/login');
    }

    // Update details
    user.name = name || user.name;
    user.phone = phone || user.phone;
    user.age = age ? Number(age) : user.age;
    user.description = description || user.description;

    // Map uploaded file paths if present
    if (req.files) {
      if (req.files['profilePhoto']) {
        user.profilePhoto = '/uploads/avatars/' + req.files['profilePhoto'][0].filename;
      }
      if (req.files['documentPhoto']) {
        user.documentPhoto = '/uploads/documents/' + req.files['documentPhoto'][0].filename;
        // Reset verification status so the admin can review the new document
        user.isVerified = false;
      }
    }

    await user.save();

    // Refresh request/locals user instance
    req.user = user;
    res.locals.user = user;

    res.render('user/profile', {
      title: 'Mi Perfil - RifaGo',
      user,
      error: null,
      success: 'Perfil actualizado con éxito. Si subiste tu documento, será verificado por el administrador.'
    });
  } catch (error) {
    console.error('Error on updateProfile:', error);
    res.render('user/profile', {
      title: 'Mi Perfil - RifaGo',
      user: req.user,
      error: error.message || 'Error al actualizar el perfil',
      success: null
    });
  }
};
