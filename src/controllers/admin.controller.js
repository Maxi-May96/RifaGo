import User from '../models/User.js';
import Raffle from '../models/Raffle.js';
import Purchase from '../models/Purchase.js';

// Renders the admin dashboard with stats and tables
export const getDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'cliente' });
    const totalRaffles = await Raffle.countDocuments();
    
    // Aggregate earnings from completed purchases
    const completedPurchases = await Purchase.find({ status: 'completed' });
    const totalEarnings = completedPurchases.reduce((acc, purchase) => acc + purchase.amount, 0);

    // Fetch the 5 most recent user registrations
    const recentUsers = await User.find({ role: 'cliente' })
      .sort({ createdAt: -1 })
      .limit(5);

    // Fetch the 5 most recent created raffles
    const recentRaffles = await Raffle.find()
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.render('admin/dashboard', {
      title: 'Panel de Administración - RifaGo',
      stats: {
        totalUsers,
        totalRaffles,
        totalEarnings
      },
      recentUsers,
      recentRaffles
    });
  } catch (error) {
    console.error('Error loading Admin Dashboard:', error);
    // Render EJS server error page or fallback
    res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
  }
};

// Renders the list of users for administration
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    
    const totalUsers = users.length;
    const verifiedUsers = users.filter(u => u.isVerified).length;
    const pendingUsers = users.filter(u => u.documentPhoto && !u.isVerified).length;

    res.render('admin/users', {
      title: 'Gestión de Usuarios - RifaGo',
      users,
      stats: {
        totalUsers,
        verifiedUsers,
        pendingUsers
      }
    });
  } catch (error) {
    console.error('Error fetching users in admin:', error);
    res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
  }
};

// Approves a user's identity verification request
export const verifyUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).render('errors/404', { title: 'Usuario no encontrado - RifaGo', layout: false });
    }
    
    user.isVerified = true;
    await user.save();
    
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error verifying user:', error);
    res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
  }
};

// Revokes a user's verification
export const unverifyUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).render('errors/404', { title: 'Usuario no encontrado - RifaGo', layout: false });
    }
    
    user.isVerified = false;
    await user.save();
    
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error unverifying user:', error);
    res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
  }
};
