import express from 'express';
import { getLogin, postLogin, getRegister, postRegister, logout } from '../controllers/auth.controller.js';

const router = express.Router();

// GET & POST Login
router.get('/login', getLogin);
router.post('/login', postLogin);

// GET & POST Register
router.get('/register', getRegister);
router.post('/register', postRegister);

// GET Logout (eases redirection from simple link actions)
router.get('/logout', logout);

export default router;
