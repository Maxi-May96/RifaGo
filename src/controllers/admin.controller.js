import User from '../models/User.js';
import Raffle from '../models/Raffle.js';
import Purchase from '../models/Purchase.js';
import Coupon from '../models/Coupon.js';

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

// GET list of all coupons and statistics
export const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });

    const totalCoupons = coupons.length;
    const activeCoupons = coupons.filter(c => c.isActive && (!c.expirationDate || new Date(c.expirationDate) >= new Date()) && (c.usageLimit === null || c.usageLimit === undefined || c.usageCount < c.usageLimit)).length;
    const expiredOrUsedCoupons = totalCoupons - activeCoupons;

    res.render('admin/coupons', {
      title: 'Gestión de Cupones - RifaGo',
      coupons,
      stats: {
        totalCoupons,
        activeCoupons,
        expiredOrUsedCoupons
      },
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Error loading Admin Coupons:', error);
    res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
  }
};

// POST create a new coupon
export const createCoupon = async (req, res) => {
  try {
    const { code, discountType, discountValue, expirationDate, usageLimit } = req.body;

    if (!code || !discountValue) {
      return res.redirect('/admin/coupons?error=El código y el valor del descuento son obligatorios.');
    }

    const uppercaseCode = code.trim().toUpperCase();

    // Check for duplicate code
    const existing = await Coupon.findOne({ code: uppercaseCode });
    if (existing) {
      return res.redirect('/admin/coupons?error=El código de cupón ya existe en el sistema.');
    }

    // Prepare parameters
    const expDate = expirationDate ? new Date(expirationDate) : null;
    const limit = usageLimit && Number(usageLimit) > 0 ? Number(usageLimit) : null;

    const newCoupon = new Coupon({
      code: uppercaseCode,
      discountType: discountType || 'percentage',
      discountValue: Number(discountValue),
      expirationDate: expDate,
      usageLimit: limit,
      isActive: true
    });

    await newCoupon.save();

    res.redirect('/admin/coupons?success=Cupón creado exitosamente.');
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.redirect(`/admin/coupons?error=${encodeURIComponent(error.message || 'Error interno al crear cupón.')}`);
  }
};

// POST delete/toggle coupon status
export const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    
    // We can physically delete it or mark it as inactive. Let's physically delete it as requested
    const deleted = await Coupon.findByIdAndDelete(id);
    if (!deleted) {
      return res.redirect('/admin/coupons?error=El cupón no existe o ya fue eliminado.');
    }

    res.redirect('/admin/coupons?success=Cupón eliminado exitosamente.');
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.redirect('/admin/coupons?error=Error interno al eliminar el cupón.');
  }
};
