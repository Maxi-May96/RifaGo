import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import userRoutes from './routes/user.routes.js';
import raffleRoutes from './routes/raffle.routes.js';
import purchaseRoutes from './routes/purchase.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import { setUser, protect } from './middleware/auth.js';
import { admin } from './middleware/admin.js';

// Resolve __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Rate limiter for login endpoint (max 10 attempts per 15 min per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middlewares
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(setUser); // Inject res.locals.user into EJS templates if logged in

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// EJS Layouts configuration
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // Uses src/views/layouts/main.ejs by default

// Routes
app.use('/auth/login', loginLimiter);  // Apply rate limiting BEFORE auth routes
app.use('/auth', authRoutes);
app.use('/admin', protect, admin, adminRoutes);
app.use('/user', protect, userRoutes);
app.use('/raffles', raffleRoutes);
app.use('/purchases', purchaseRoutes);
app.use('/payments', paymentRoutes);

import Raffle from './models/Raffle.js';

// Basic Routes
app.get('/', async (req, res) => {
  try {
    // Fetch active raffles sorted by closest draw date
    const activeRaffles = await Raffle.find({ status: 'activo' })
      .populate('category', 'name')
      .sort({ drawDate: 1 })
      .limit(6);

    res.render('home/index', { 
      title: 'Inicio - RifaGo',
      activeRaffles 
    });
  } catch (error) {
    console.error('Error fetching home active raffles:', error);
    res.render('home/index', { 
      title: 'Inicio - RifaGo', 
      activeRaffles: [] 
    });
  }
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).render('errors/404', { title: 'Página no encontrada - RifaGo', layout: false });
});

// 500 error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
});

export default app;
