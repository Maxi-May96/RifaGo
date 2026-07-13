import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env.js';

// Helper to sign JWT
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Renders the Login page
export const getLogin = (req, res) => {
  if (req.cookies && req.cookies.token) {
    return res.redirect('/');
  }
  res.render('auth/login', { title: 'Iniciar Sesión - RifaGo', error: null });
};

// Handles login request
export const postLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.render('auth/login', { title: 'Iniciar Sesión - RifaGo', error: 'Todos los campos son obligatorios' });
    }
    
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.render('auth/login', { title: 'Iniciar Sesión - RifaGo', error: 'Credenciales incorrectas' });
    }

    const token = generateToken(user._id);

    // Set cookie containing the JWT
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.redirect('/');
  } catch (error) {
    console.error('Error on postLogin:', error);
    res.render('auth/login', { title: 'Iniciar Sesión - RifaGo', error: 'Ocurrió un error en el servidor' });
  }
};

// Renders the Register page
export const getRegister = (req, res) => {
  if (req.cookies && req.cookies.token) {
    return res.redirect('/');
  }
  res.render('auth/register', { title: 'Registrarse - RifaGo', error: null });
};

// Handles registration request
export const postRegister = async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  try {
    if (!name || !email || !password) {
      return res.render('auth/register', { title: 'Registrarse - RifaGo', error: 'Todos los campos son obligatorios' });
    }
    if (password.length < 6) {
      return res.render('auth/register', { title: 'Registrarse - RifaGo', error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (password !== confirmPassword) {
      return res.render('auth/register', { title: 'Registrarse - RifaGo', error: 'Las contraseñas no coinciden' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('auth/register', { title: 'Registrarse - RifaGo', error: 'El correo ya está registrado' });
    }

    // Auto-promote the first user in database to admin, else default to cliente
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'cliente';

    const user = await User.create({
      name,
      email,
      password,
      role
    });

    const token = generateToken(user._id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.redirect('/');
  } catch (error) {
    console.error('Error on postRegister:', error);
    res.render('auth/register', { title: 'Registrarse - RifaGo', error: 'Error al registrar el usuario' });
  }
};

// Handles logout request
export const logout = (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
};
