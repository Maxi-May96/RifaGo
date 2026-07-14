import User from '../models/User.js';
import Purchase from '../models/Purchase.js';
import Withdrawal from '../models/Withdrawal.js';
import mongoose from 'mongoose';

// Renders the User Profile page
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // 1. Calculate Expenses (purchases made by user)
    const expenses = await Purchase.aggregate([
      { 
        $match: { 
          user: new mongoose.Types.ObjectId(req.user._id),
          status: 'completed' 
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          total: { $sum: "$amount" }
        }
      }
    ]);

    // 2. Calculate Revenues (purchases made on user's raffles)
    const revenues = await Purchase.aggregate([
      { 
        $match: { status: 'completed' } 
      },
      {
        $lookup: {
          from: 'raffles',
          localField: 'raffle',
          foreignField: '_id',
          as: 'raffleInfo'
        }
      },
      { $unwind: '$raffleInfo' },
      { 
        $match: { 
          'raffleInfo.creator': new mongoose.Types.ObjectId(req.user._id)
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          total: { $sum: "$amount" }
        }
      }
    ]);

    // 3. Consolidate into Monthly Balances map
    const balanceMap = {};

    revenues.forEach(r => {
      const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
      if (!balanceMap[key]) balanceMap[key] = { income: 0, expense: 0 };
      balanceMap[key].income = r.total;
    });

    expenses.forEach(e => {
      const key = `${e._id.year}-${String(e._id.month).padStart(2, '0')}`;
      if (!balanceMap[key]) balanceMap[key] = { income: 0, expense: 0 };
      balanceMap[key].expense = e.total;
    });

    const monthlyBalances = Object.keys(balanceMap).map(key => {
      const [year, month] = key.split('-');
      const income = balanceMap[key].income;
      const expense = balanceMap[key].expense;
      return {
        key,
        year: parseInt(year),
        month: parseInt(month),
        income,
        expense,
        net: income - expense
      };
    }).sort((a, b) => b.key.localeCompare(a.key));

    // 4. Calculate total metrics
    const totalEarned = revenues.reduce((acc, r) => acc + r.total, 0);

    // 5. Fetch withdrawals and calculate balances
    const withdrawals = await Withdrawal.find({ user: req.user._id }).sort({ createdAt: -1 });
    
    const totalWithdrawn = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((acc, w) => acc + w.amount, 0);

    const totalPendingWithdrawal = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((acc, w) => acc + w.amount, 0);

    // Withdrawable balance is total earnings plus refunds/balance minus completed and pending withdrawals
    const withdrawableAmount = totalEarned + (user.balance || 0) - totalWithdrawn - totalPendingWithdrawal;

    res.render('user/profile', {
      title: 'Mi Perfil - RifaGo',
      user,
      monthlyBalances,
      totalEarned,
      withdrawals,
      withdrawableAmount,
      totalWithdrawn,
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Error on getProfile:', error);
    res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
  }
};

// Handles profile updates and file uploads
export const updateProfile = async (req, res) => {
  const { name, phone, age, description, cvu, alias, bankName, redirectTab } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.redirect('/auth/login');
    }

    // Update details
    user.name = name || user.name;
    user.phone = phone !== undefined ? phone : user.phone;
    user.age = age ? Number(age) : user.age;
    user.description = description !== undefined ? description : user.description;

    // Update banking details
    user.cvu = cvu !== undefined ? cvu : user.cvu;
    user.alias = alias !== undefined ? alias : user.alias;
    user.bankName = bankName !== undefined ? bankName : user.bankName;

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

    const targetTab = redirectTab || 'details';
    res.redirect(`/user/profile?tab=${targetTab}&success=${encodeURIComponent('Perfil actualizado con éxito.')}`);
  } catch (error) {
    console.error('Error on updateProfile:', error);
    const targetTab = req.body.redirectTab || 'details';
    res.redirect(`/user/profile?tab=${targetTab}&error=${encodeURIComponent(error.message || 'Error al actualizar el perfil')}`);
  }
};

// POST /user/withdraw (Handles money withdrawal request)
export const requestWithdrawal = async (req, res) => {
  const { amount, bankName, cbu, alias, holderName } = req.body;
  try {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      return res.redirect('/user/profile?error=El monto mínimo de retiro es de $100 ARS.&tab=balance');
    }

    if (!bankName || !cbu || !alias || !holderName) {
      return res.redirect('/user/profile?error=Todos los datos de la cuenta de destino son obligatorios.&tab=balance');
    }

    // Calculate dynamic balance to ensure they have enough funds
    const revenues = await Purchase.aggregate([
      { $match: { status: 'completed' } },
      {
        $lookup: {
          from: 'raffles',
          localField: 'raffle',
          foreignField: '_id',
          as: 'raffleInfo'
        }
      },
      { $unwind: '$raffleInfo' },
      { $match: { 'raffleInfo.creator': new mongoose.Types.ObjectId(req.user._id) } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalEarned = revenues.length > 0 ? revenues[0].total : 0;

    const withdrawals = await Withdrawal.find({ 
      user: req.user._id,
      status: { $in: ['completed', 'pending'] }
    });
    
    const totalDeducted = withdrawals.reduce((acc, w) => acc + w.amount, 0);
    const withdrawableAmount = totalEarned - totalDeducted;

    if (numAmount > withdrawableAmount) {
      return res.redirect(`/user/profile?error=Fondos insuficientes. Tu saldo retirable es de $${withdrawableAmount.toLocaleString('es-AR')} ARS.&tab=balance`);
    }

    // Save withdrawal request
    const newWithdrawal = new Withdrawal({
      user: req.user._id,
      amount: numAmount,
      destination: {
        bankName,
        cbu,
        alias,
        holderName
      }
    });

    await newWithdrawal.save();

    res.redirect('/user/profile?success=Solicitud de retiro enviada correctamente. El administrador la procesará a la brevedad.&tab=balance');
  } catch (error) {
    console.error('Error requesting withdrawal:', error);
    res.redirect(`/user/profile?error=${encodeURIComponent(error.message || 'Error al solicitar el retiro.')}&tab=balance`);
  }
};

// GET /user/balance/download-pdf (Downloads PDF balance report)
import PDFDocument from 'pdfkit';

export const downloadBalancePDF = async (req, res) => {
  const { startMonth, endMonth } = req.query;
  try {
    // 1. Calculate Expenses (purchases made by user)
    const expenses = await Purchase.aggregate([
      { 
        $match: { 
          user: new mongoose.Types.ObjectId(req.user._id),
          status: 'completed' 
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          total: { $sum: "$amount" }
        }
      }
    ]);

    // 2. Calculate Revenues (purchases made on user's raffles)
    const revenues = await Purchase.aggregate([
      { 
        $match: { status: 'completed' } 
      },
      {
        $lookup: {
          from: 'raffles',
          localField: 'raffle',
          foreignField: '_id',
          as: 'raffleInfo'
        }
      },
      { $unwind: '$raffleInfo' },
      { 
        $match: { 
          'raffleInfo.creator': new mongoose.Types.ObjectId(req.user._id)
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          total: { $sum: "$amount" }
        }
      }
    ]);

    // 3. Consolidate into Monthly Balances
    const balanceMap = {};

    revenues.forEach(r => {
      const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
      if (!balanceMap[key]) balanceMap[key] = { income: 0, expense: 0 };
      balanceMap[key].income = r.total;
    });

    expenses.forEach(e => {
      const key = `${e._id.year}-${String(e._id.month).padStart(2, '0')}`;
      if (!balanceMap[key]) balanceMap[key] = { income: 0, expense: 0 };
      balanceMap[key].expense = e.total;
    });

    let monthlyBalances = Object.keys(balanceMap).map(key => {
      const [year, month] = key.split('-');
      const income = balanceMap[key].income;
      const expense = balanceMap[key].expense;
      return {
        key,
        year: parseInt(year),
        month: parseInt(month),
        income,
        expense,
        net: income - expense
      };
    }).sort((a, b) => b.key.localeCompare(a.key));

    // Filter by period if requested
    if (startMonth) {
      monthlyBalances = monthlyBalances.filter(b => b.key >= startMonth);
    }
    if (endMonth) {
      monthlyBalances = monthlyBalances.filter(b => b.key <= endMonth);
    }

    // 4. Generate PDF using PDFKit
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=RifaGo_Balance_${Date.now()}.pdf`);

    doc.pipe(res);

    // Decorative Header Band
    doc.rect(0, 0, 612, 100).fill('#6366f1'); // Indigomark (Primary)
    
    // Header text
    doc.fillColor('white').font('Helvetica-Bold').fontSize(22).text('RifaGo', 50, 30);
    doc.font('Helvetica').fontSize(12).text('Reporte de Balance y Finanzas Mensuales', 50, 58);
    
    // Content body
    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(14).text('Resumen del Periodo', 50, 130);
    
    // Metadata details
    doc.font('Helvetica').fontSize(10).fillColor('#64748b');
    doc.text(`Titular de Cuenta: ${req.user.name}`, 50, 155);
    doc.text(`Email Registrado: ${req.user.email}`, 50, 170);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR')}`, 50, 185);
    doc.text(`Filtro Periodo: ${startMonth || 'Todos'} a ${endMonth || 'Todos'}`, 50, 200);

    // Summary Box (Cards)
    const totalIncomes = monthlyBalances.reduce((acc, b) => acc + b.income, 0);
    const totalExpenses = monthlyBalances.reduce((acc, b) => acc + b.expense, 0);
    const totalNet = totalIncomes - totalExpenses;

    doc.rect(340, 130, 220, 85).fill('#f8fafc').stroke('#e2e8f0');
    doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(9).text('TOTAL GENERADO (INGRESOS):', 350, 142);
    doc.fillColor('#10b981').fontSize(12).text(`$${totalIncomes.toLocaleString('es-AR')} ARS`, 350, 155);
    
    doc.fillColor('#64748b').fontSize(9).text('TOTAL GASTADO (EGRESOS):', 350, 175);
    doc.fillColor('#ef4444').fontSize(12).text(`$${totalExpenses.toLocaleString('es-AR')} ARS`, 350, 188);

    doc.moveDown(3);

    // Table Headers
    const tableTop = 245;
    doc.rect(50, tableTop, 512, 22).fill('#e2e8f0');
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(10);
    doc.text('Mes / Periodo', 60, tableTop + 6);
    doc.text('Ingresos (Ventas)', 180, tableTop + 6);
    doc.text('Egresos (Compras)', 310, tableTop + 6);
    doc.text('Resultado Neto', 440, tableTop + 6);

    let y = tableTop + 22;
    doc.font('Helvetica');

    if (monthlyBalances.length === 0) {
      doc.text('No se registraron movimientos en el periodo seleccionado.', 60, y + 15, { align: 'center', width: 492 });
    } else {
      monthlyBalances.forEach((item, idx) => {
        // Zebra striping
        if (idx % 2 === 1) {
          doc.rect(50, y, 512, 20).fill('#f8fafc');
        }
        
        doc.fillColor('#1e293b');
        doc.text(item.key, 60, y + 5);
        doc.text(`$${item.income.toLocaleString('es-AR')}`, 180, y + 5);
        doc.text(`$${item.expense.toLocaleString('es-AR')}`, 310, y + 5);
        
        const netText = `$${item.net.toLocaleString('es-AR')} ARS`;
        if (item.net >= 0) {
          doc.fillColor('#10b981').text(netText, 440, y + 5);
        } else {
          doc.fillColor('#ef4444').text(netText, 440, y + 5);
        }
        
        y += 20;

        // Draw horizontal line
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, y).lineTo(562, y).stroke();

        // Page breaks
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
      });
    }

    // Draw Final Balance Row
    y += 10;
    doc.rect(50, y, 512, 25).fill('#e0e7ff'); // Soft Indigo
    doc.fillColor('#312e81').font('Helvetica-Bold').fontSize(10);
    doc.text('BALANCE TOTAL CONSOLIDADO:', 60, y + 8);
    
    const finalNetText = `$${totalNet.toLocaleString('es-AR')} ARS`;
    if (totalNet >= 0) {
      doc.fillColor('#047857').text(finalNetText, 440, y + 8);
    } else {
      doc.fillColor('#b91c1c').text(finalNetText, 440, y + 8);
    }

    // Footer signature
    doc.fillColor('#94a3b8').font('Helvetica-Oblique').fontSize(8);
    doc.text('Documento de control interno generado automáticamente por RifaGo.', 50, 740, { align: 'center', width: 512 });

    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error interno al generar el archivo PDF.');
  }
};
