import { randomInt } from 'crypto';
import Raffle from '../models/Raffle.js';
import Category from '../models/Category.js';
import Purchase from '../models/Purchase.js';
import Payment from '../models/Payment.js';
import { uploadFile, deleteUploadedFile } from '../services/firebase.service.js';
import { GOOGLE_MAPS_API_KEY, APP_BASE_URL } from '../config/env.js';
import Coupon from '../models/Coupon.js';
import { createPreference } from '../services/payment.service.js';
import NumberModel from '../models/Number.js';
import Report from '../models/Report.js';
import User from '../models/User.js';

// GET list of own and participated raffles
export const getMyRaffles = async (req, res) => {
  try {
    const { q, status, sort } = req.query;
    const userId = req.user._id;

    // 1. Fetch Created Raffles
    const query = { creator: userId };
    
    if (q) {
      query.title = { $regex: q, $options: 'i' };
    }
    if (status) {
      query.status = status;
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'date') {
      sortOption = { drawDate: 1 };
    } else if (sort === 'sales') {
      sortOption = { soldTickets: -1 };
    }

    const createdRaffles = await Raffle.find(query)
      .populate('category', 'name')
      .populate('winner', 'name email phone')
      .sort(sortOption);

    // 2. Fetch Participated Raffles
    // Fetch all completed purchases for this user
    const purchases = await Purchase.find({ user: userId, status: 'completed' })
      .populate({
        path: 'raffle',
        populate: { path: 'creator', select: 'name' }
      });

    // Group purchases by raffle ID so they appear as unique raffle cards
    const participatedMap = new Map();
    purchases.forEach(p => {
      if (!p.raffle) return; // Skip if raffle was deleted
      const raffleId = p.raffle._id.toString();
      if (participatedMap.has(raffleId)) {
        const existing = participatedMap.get(raffleId);
        existing.myTickets = [...existing.myTickets, ...p.numbers];
      } else {
        participatedMap.set(raffleId, {
          raffle: p.raffle,
          myTickets: [...p.numbers],
          purchaseDate: p.createdAt
        });
      }
    });

    const participatedRaffles = Array.from(participatedMap.values());

    // 3. Fetch Pending Purchases for Own Raffles (manual bank confirmations)
    const ownRaffleIds = createdRaffles.map(r => r._id);
    const pendingPurchases = await Purchase.find({ 
      raffle: { $in: ownRaffleIds }, 
      status: 'pending_payment' 
    }).populate('user', 'name email phone').populate('raffle', 'title');

    res.render('raffle/myraffles', {
      title: 'Mis Sorteos - RifaGo',
      createdRaffles,
      participatedRaffles,
      pendingPurchases,
      filters: {
        q: q || '',
        status: status || '',
        sort: sort || ''
      },
      error: req.query.error || null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Error in getMyRaffles:', error);
    res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
  }
};

// POST Action to execute the draw and pick a winner
export const drawRaffle = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const raffle = await Raffle.findById(id);
    if (!raffle) {
      return res.status(404).render('errors/404', { title: 'No Encontrado - RifaGo', layout: false });
    }

    if (raffle.creator.toString() !== userId.toString()) {
      return res.status(403).render('errors/403', { title: 'No Autorizado - RifaGo', layout: false });
    }

    if (raffle.status === 'finalizado' || raffle.winner) {
      return res.redirect('/raffles/myraffles');
    }

    // Find all completed purchases for this raffle
    const purchases = await Purchase.find({ raffle: id, status: 'completed' }).populate('user');

    if (!purchases || purchases.length === 0 || raffle.soldTickets === 0) {
      return res.redirect('/raffles/myraffles?error=' + encodeURIComponent('No se puede realizar el sorteo porque no se ha vendido ningún boleto.'));
    }

    // Gather all valid sold ticket entries
    const allSoldTickets = [];
    purchases.forEach(p => {
      if (p.user && p.numbers && Array.isArray(p.numbers)) {
        p.numbers.forEach(num => {
          allSoldTickets.push({
            number: num,
            userId: p.user._id
          });
        });
      }
    });

    if (allSoldTickets.length === 0) {
      return res.redirect('/raffles/myraffles?error=' + encodeURIComponent('No hay boletos válidos para el sorteo.'));
    }

    // Pick a random ticket using cryptographically secure random
    const randomIndex = randomInt(0, allSoldTickets.length);
    const winningTicket = allSoldTickets[randomIndex];

    // Set winner and status
    raffle.winner = winningTicket.userId;
    raffle.winningNumber = winningTicket.number;
    raffle.status = 'finalizado';
    await raffle.save();

    return res.redirect('/raffles/myraffles');
  } catch (error) {
    console.error('Error in drawRaffle:', error);
    return res.redirect('/raffles/myraffles?error=' + encodeURIComponent('Ocurrió un error al procesar el sorteo.'));
  }
};

export const getCreateRaffle = async (req, res) => {
  try {
    res.render('raffle/create', {
      title: 'Crear Nuevo Sorteo - RifaGo',
      googleMapsApiKey: GOOGLE_MAPS_API_KEY || ''
    });
  } catch (error) {
    console.error('Error rendering Create Raffle page:', error);
    res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
  }
};

// POST process Wizard creation form
export const postCreateRaffle = async (req, res) => {
  try {
    const {
      title,
      motivo,
      description,
      category,
      timezone,
      country,
      province,
      city,
      address,
      latitude,
      longitude,
      totalTickets,
      ticketPrice,
      maxPerBuyer,
      ticketSelectionMode,
      couponCode,
      creationCost,
      drawDate,
      drawTime,
      publishImmediately,
      paymentMode,
      transfer_cbu,
      transfer_alias,
      transfer_bank,
      transfer_instructions
    } = req.body;

    // Combine date and time
    const finalDrawDate = new Date(`${drawDate}T${drawTime || '00:00'}`);

    // Process files uploaded via multer
    const files = req.files || [];
    
    // Find main image
    const mainImageFile = files.find(f => f.fieldname === 'image');
    const mainImageUrl = mainImageFile ? await uploadFile(mainImageFile, 'raffles') : '';

    // Find gallery images
    const galleryFiles = files.filter(f => f.fieldname === 'images');
    const galleryUrls = [];
    for (const file of galleryFiles) {
      const url = await uploadFile(file, 'raffles');
      if (url) galleryUrls.push(url);
    }

    // Process prizes (flat array mappings)
    const premios = [];
    const prizeNames = Array.isArray(req.body.premio_nombre) ? req.body.premio_nombre : (req.body.premio_nombre ? [req.body.premio_nombre] : []);
    const prizeDescs = Array.isArray(req.body.premio_descripcion) ? req.body.premio_descripcion : (req.body.premio_descripcion ? [req.body.premio_descripcion] : []);
    const prizeValues = Array.isArray(req.body.premio_valor) ? req.body.premio_valor : (req.body.premio_valor ? [req.body.premio_valor] : []);
    const prizePositions = Array.isArray(req.body.premio_posicion) ? req.body.premio_posicion : (req.body.premio_posicion ? [req.body.premio_posicion] : []);

    for (let i = 0; i < prizeNames.length; i++) {
      const prizeFile = files.find(f => f.fieldname === `premio_imagen_${i}`);
      const prizeImgUrl = prizeFile ? await uploadFile(prizeFile, 'premios') : '';

      premios.push({
        nombre: prizeNames[i],
        descripcion: prizeDescs[i] || '',
        valor: prizeValues[i] ? Number(prizeValues[i]) : null,
        posicion: prizePositions[i] || `${i + 1}°`,
        imagen: prizeImgUrl
      });
    }

    // Determine initial status:
    // If publishImmediately is true, we activate immediately if creation cost is 0,
    // otherwise it goes to 'pendiente' status until payment is confirmed.
    // If publishImmediately is false, it goes to 'borrador'.
    const cost = Number(creationCost || 0);
    let initialStatus = 'borrador';
    let isCreationPaid = false;

    if (publishImmediately === 'true') {
      if (cost > 0) {
        initialStatus = 'pendiente';
      } else {
        initialStatus = 'activo';
        isCreationPaid = true;
      }
    }

    const newRaffle = new Raffle({
      title,
      motivo,
      description,
      category,
      timezone,
      country,
      province,
      city,
      address: address || '',
      lat: latitude ? Number(latitude) : null,
      lng: longitude ? Number(longitude) : null,
      totalTickets: Number(totalTickets),
      ticketPrice: Number(ticketPrice),
      couponCode: couponCode || null,
      creationCost: cost,
      maxPerBuyer: Number(maxPerBuyer || 10),
      ticketSelectionMode: ticketSelectionMode || 'auto',
      premios,
      images: galleryUrls,
      image: mainImageUrl || (galleryUrls.length > 0 ? galleryUrls[0] : ''),
      status: initialStatus,
      drawDate: finalDrawDate,
      creator: req.user._id,
      paymentMode: paymentMode || 'rifago',
      transferInfo: {
        cbu: transfer_cbu || '',
        alias: transfer_alias || '',
        bankName: transfer_bank || '',
        instructions: transfer_instructions || ''
      },
      creationPaid: isCreationPaid
    });

    // Validate and increment coupon usage if applied
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (coupon) {
        // Expiration check
        if (coupon.expirationDate && new Date(coupon.expirationDate) < new Date()) {
          return res.status(400).render('raffle/create', {
            title: 'Crear Nuevo Sorteo - RifaGo',
            googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
            error: 'El código de descuento ingresado ha caducado.'
          });
        }
        // Usage limit check
        if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usageCount >= coupon.usageLimit) {
          return res.status(400).render('raffle/create', {
            title: 'Crear Nuevo Sorteo - RifaGo',
            googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
            error: 'El código de descuento ingresado ha superado su límite de usos.'
          });
        }
        // Minimum tickets check
        if (coupon.minTickets && newRaffle.totalTickets < coupon.minTickets) {
          return res.status(400).render('raffle/create', {
            title: 'Crear Nuevo Sorteo - RifaGo',
            googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
            error: `El código de descuento ingresado es válido únicamente para sorteos con al menos ${coupon.minTickets} números.`
          });
        }
        // Increment usage
        coupon.usageCount += 1;
        await coupon.save();
      }
    }

    await newRaffle.save();

    // If it's published and requires creation fee payment, create Mercado Pago Preference
    if (publishImmediately === 'true' && cost > 0) {
      const payment = await Payment.create({
        raffle: newRaffle._id,
        user: req.user._id,
        amount: cost,
        status: 'pending',
        type: 'creation'
      });

      const preference = await createPreference({
        title: `Pago de creación: ${newRaffle.title}`,
        quantity: 1,
        unitPrice: cost,
        externalReference: payment._id.toString(),
        backUrlSuccess: `${APP_BASE_URL}/raffles/creation-success`,
        backUrlFailure: `${APP_BASE_URL}/raffles/creation-failure`
      });

      payment.mpPreferenceId = preference.id;
      await payment.save();

      // Redirect user to Mercado Pago checkout
      return res.redirect(preference.init_point);
    }

    res.redirect('/raffles/myraffles');
  } catch (error) {
    console.error('Error creating raffle:', error);
    res.render('raffle/create', {
      title: 'Crear Nuevo Sorteo - RifaGo',
      googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
      error: error.message || 'Error al guardar el sorteo. Revisa los datos e intenta de nuevo.'
    });
  }
};

// POST duplicate an existing raffle as a draft
export const duplicateRaffle = async (req, res) => {
  try {
    const { id } = req.params;
    const original = await Raffle.findById(id);

    if (!original) {
      return res.status(404).render('errors/404', { title: 'Sorteo no encontrado - RifaGo', layout: false });
    }

    // Security check: Only original creator can duplicate
    if (original.creator.toString() !== req.user._id.toString()) {
      return res.status(403).render('errors/500', { title: 'No Autorizado - RifaGo', layout: false });
    }

    // Clone prizes but clear images or keep them
    const clonedPremios = original.premios.map(p => ({
      nombre: p.nombre,
      descripcion: p.descripcion,
      valor: p.valor,
      posicion: p.posicion,
      imagen: p.imagen
    }));

    // Clone raffle schema
    const clonedRaffle = new Raffle({
      title: `${original.title} (Copia)`,
      motivo: original.motivo,
      description: original.description,
      category: original.category,
      timezone: original.timezone,
      country: original.country,
      province: original.province,
      city: original.city,
      address: original.address,
      totalTickets: original.totalTickets,
      ticketPrice: original.ticketPrice,
      maxPerBuyer: original.maxPerBuyer,
      ticketSelectionMode: original.ticketSelectionMode,
      premios: clonedPremios,
      images: original.images,
      image: original.image,
      status: 'borrador',
      drawDate: original.drawDate, // copy date, user can adjust
      creator: req.user._id
    });

    await clonedRaffle.save();

    res.redirect('/raffles/myraffles');
  } catch (error) {
    console.error('Error duplicating raffle:', error);
    res.redirect('/raffles/myraffles?error=Error al duplicar sorteo');
  }
};

// POST delete an existing raffle (Full cascaded delete including participants & images)
export const deleteRaffle = async (req, res) => {
  try {
    const { id } = req.params;
    const raffle = await Raffle.findById(id);

    if (!raffle) {
      return res.status(404).render('errors/404', { title: 'Sorteo no encontrado - RifaGo', layout: false });
    }

    // Security check: Only creator can delete
    if (raffle.creator.toString() !== req.user._id.toString()) {
      return res.status(403).render('errors/500', { title: 'No Autorizado - RifaGo', layout: false });
    }

    // Regla de negocio: no puedes eliminar si ya hay participante (boletos vendidos o reservados)
    const hasParticipants = await NumberModel.exists({ raffle: raffle._id });
    if (hasParticipants || (raffle.soldTickets && raffle.soldTickets > 0)) {
      return res.redirect('/raffles/myraffles?error=' + encodeURIComponent('No puedes eliminar un sorteo que ya tiene participantes o boletos seleccionados.'));
    }

    // 1. Gather all associated image URLs to delete them physically
    const urlsToDelete = [];
    if (raffle.image) urlsToDelete.push(raffle.image);
    if (raffle.images && raffle.images.length > 0) {
      urlsToDelete.push(...raffle.images);
    }
    if (raffle.premios && raffle.premios.length > 0) {
      raffle.premios.forEach(p => {
        if (p.imagen) urlsToDelete.push(p.imagen);
      });
    }

    // Physically delete all files (local or Firebase Cloud Storage)
    for (const url of urlsToDelete) {
      await deleteUploadedFile(url);
    }

    // 2. Refund creation cost to creator's balance if creationPaid is true and creationCost > 0
    if (raffle.creationPaid && raffle.creationCost > 0) {
      const creator = await User.findById(raffle.creator);
      if (creator) {
        creator.balance = (creator.balance || 0) + raffle.creationCost;
        await creator.save();
      }
    }

    // 3. Cascade delete from database
    await NumberModel.deleteMany({ raffle: id });
    await Purchase.deleteMany({ raffle: id });
    await Payment.deleteMany({ raffle: id });
    await Raffle.findByIdAndDelete(id);

    res.redirect('/raffles/myraffles?success=' + encodeURIComponent('Sorteo eliminado con éxito'));
  } catch (error) {
    console.error('Error deleting raffle:', error);
    res.redirect('/raffles/myraffles?error=' + encodeURIComponent('Error al eliminar el sorteo'));
  }
};

// GET Export buyers list to CSV
export const exportBuyers = async (req, res) => {
  try {
    const { id } = req.params;
    const raffle = await Raffle.findById(id);

    if (!raffle) {
      return res.status(404).send('Sorteo no encontrado');
    }

    // Check ownership
    if (raffle.creator.toString() !== req.user._id.toString()) {
      return res.status(403).send('No autorizado');
    }

    // Fetch purchases for this raffle
    const purchases = await Purchase.find({ raffle: id, status: 'completed' })
      .populate('user', 'name email phone');

    // Build CSV Content
    let csvContent = '\uFEFF'; // Add BOM for Excel UTF-8 representation
    csvContent += 'Nombre,Email,Telefono,Numeros Comprados,Monto Pagado,Fecha Compra\n';

    purchases.forEach(p => {
      const name = p.user ? p.user.name.replace(/"/g, '""') : 'Anónimo';
      const email = p.user ? p.user.email : '—';
      const phone = p.user && p.user.phone ? p.user.phone : '—';
      const tickets = `"${p.numbers.join(', ')}"`;
      const amount = p.amount;
      const date = new Date(p.createdAt).toLocaleString();

      csvContent += `"${name}","${email}","${phone}",${tickets},${amount},"${date}"\n`;
    });

    // Set download headers
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=compradores-${raffle.slug}.csv`);
    
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting buyers CSV:', error);
    res.status(500).send('Error del servidor al exportar lista de compradores');
  }
};

// GET single raffle details (public page)
export const getRaffleDetail = async (req, res) => {
  try {
    const { slug } = req.params;
    let raffle;
    if (slug.match(/^[0-9a-fA-F]{24}$/)) {
      raffle = await Raffle.findById(slug).populate('creator').populate('winner', 'name email');
    } else {
      raffle = await Raffle.findOne({ slug }).populate('creator').populate('winner', 'name email');
    }
    
    if (!raffle) {
      return res.status(404).render('errors/404', { title: 'Sorteo no encontrado - RifaGo', layout: false });
    }

    // Import and clean up expired reservations on details load
    const { cleanupExpiredReservations } = await import('./purchase.controller.js');
    await cleanupExpiredReservations();

    // Fetch all active numbers (reserved, pending_payment, or sold)
    const activeNumbersDocs = await NumberModel.find({ raffle: raffle._id });
    
    // Format them for the view: { [number]: { status, user, purchase } }
    const activeNumbers = {};
    activeNumbersDocs.forEach(n => {
      activeNumbers[n.number] = {
        status: n.status,
        user: n.user,
        purchase: n.purchase
      };
    });

    const soldNumbers = activeNumbersDocs.filter(n => n.status === 'sold').map(n => n.number);

    res.render('raffle/detail', { 
      title: `${raffle.title} - RifaGo`,
      raffle,
      activeNumbers,
      soldNumbers,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
    });
  } catch (error) {
    console.error('Error fetching raffle detail:', error);
    res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
  }
};

// GET validate coupon code for raffle creation cost
export const validateCoupon = async (req, res) => {
  try {
    const { code, totalTickets } = req.query;
    if (!code) {
      return res.status(400).json({ valid: false, message: 'El código de cupón es requerido' });
    }
    
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) {
      return res.json({ valid: false, message: 'Código de descuento inválido o inactivo' });
    }

    // Check expiration date
    if (coupon.expirationDate && new Date(coupon.expirationDate) < new Date()) {
      return res.json({ valid: false, message: 'El cupón ha caducado' });
    }

    // Check usage limit
    if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usageCount >= coupon.usageLimit) {
      return res.json({ valid: false, message: 'El cupón ha agotado su límite de usos' });
    }

    // Check minimum tickets requirement
    if (coupon.minTickets && totalTickets) {
      const ticketsCount = Number(totalTickets);
      if (ticketsCount < coupon.minTickets) {
        return res.json({ 
          valid: false, 
          message: `Este cupón sólo aplica para sorteos con al menos ${coupon.minTickets} números` 
        });
      }
    }
    
    res.json({
      valid: true,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue
    });
  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({ valid: false, message: 'Error interno del servidor al validar cupón' });
  }
};

// GET list of all active raffles with filters (public page)
export const getRafflesList = async (req, res) => {
  try {
    const { country, province, q, latitude, longitude, radius } = req.query;
    
    // We only show active raffles in the public page
    const query = { status: 'activo' };
    
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { motivo: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (country) {
      query.country = { $regex: country, $options: 'i' };
    }
    
    if (province) {
      query.province = { $regex: province, $options: 'i' };
    }
    
    const latVal = parseFloat(latitude);
    const lngVal = parseFloat(longitude);
    const radVal = parseFloat(radius) || 25; // default 25km
    
    if (!isNaN(latVal) && !isNaN(lngVal)) {
      const latOffset = radVal / 111.12;
      const lngOffset = radVal / (111.12 * Math.cos(latVal * Math.PI / 180));
      
      query.lat = { $gte: latVal - latOffset, $lte: latVal + latOffset };
      query.lng = { $gte: lngVal - lngOffset, $lte: lngVal + lngOffset };
    }
    
    let raffles = await Raffle.find(query).populate('creator').populate('category');
    
    // Compute distance if coordinates are provided
    if (!isNaN(latVal) && !isNaN(lngVal)) {
      raffles = raffles.map(r => {
        const rObj = r.toObject();
        if (r.lat && r.lng) {
          rObj.distance = getDistanceInKm(latVal, lngVal, r.lat, r.lng);
        } else {
          rObj.distance = null;
        }
        return rObj;
      });
      
      // Sort by distance (putting ones without coordinates at the end)
      raffles.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    } else {
      // Default sorting: newest first
      raffles = raffles.map(r => r.toObject());
      raffles.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    res.render('raffle/index', {
      title: 'Explorar Sorteos - RifaGo',
      raffles,
      googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
      filters: { country, province, q, latitude, longitude, radius: radVal }
    });
  } catch (error) {
    console.error('Error fetching raffles list:', error);
    res.status(500).render('errors/500', { title: 'Error del Servidor - RifaGo', layout: false });
  }
};

// Helper distance functions
function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
    ;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// GET /raffles/creation-success (Callback from MP on creation fee approval)
export const confirmRaffleCreation = async (req, res) => {
  try {
    const { payment_id, status, external_reference } = req.query;
    
    const payment = await Payment.findById(external_reference);
    if (!payment) {
      return res.status(404).render('errors/500', { 
        title: 'Error de Pago - RifaGo', 
        message: 'No se encontró el registro de pago para este sorteo.',
        layout: false 
      });
    }

    // Mercado Pago passes status approved or pending
    if (status === 'approved' || req.query.collection_status === 'approved') {
      payment.status = 'approved';
      payment.mpPaymentId = payment_id;
      payment.mpStatus = status;
      await payment.save();

      // Update Raffle to be active and creation paid
      const raffle = await Raffle.findById(payment.raffle);
      if (raffle) {
        raffle.status = 'activo';
        raffle.creationPaid = true;
        raffle.creationPaymentId = payment_id;
        await raffle.save();
      }

      return res.redirect('/raffles/myraffles?success=' + encodeURIComponent('¡Sorteo publicado con éxito!'));
    } else {
      payment.status = 'rejected';
      payment.mpPaymentId = payment_id;
      payment.mpStatus = status;
      await payment.save();

      return res.redirect('/raffles/myraffles?error=' + encodeURIComponent('El pago de la tasa fue rechazado. Tu sorteo quedó guardado como borrador.'));
    }
  } catch (error) {
    console.error('Error in confirmRaffleCreation:', error);
    res.redirect('/raffles/myraffles?error=' + encodeURIComponent('Ocurrió un error al procesar el pago del sorteo.'));
  }
};

// GET /raffles/creation-failure (Callback from MP on failure/cancellation)
export const failRaffleCreation = async (req, res) => {
  try {
    const { external_reference } = req.query;
    if (external_reference) {
      const payment = await Payment.findById(external_reference);
      if (payment) {
        payment.status = 'cancelled';
        await payment.save();
      }
    }
    res.redirect('/raffles/myraffles?error=' + encodeURIComponent('El pago del sorteo fue cancelado o falló. Quedó guardado como borrador.'));
  } catch (error) {
    console.error('Error in failRaffleCreation:', error);
    res.redirect('/raffles/myraffles?error=' + encodeURIComponent('El pago del sorteo falló.'));
  }
};

// POST /raffles/:id/report (Report a raffle)
export const reportRaffle = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const raffle = await Raffle.findById(id);
    if (!raffle) {
      return res.status(404).render('errors/404', { title: 'Sorteo no encontrado - RifaGo', layout: false });
    }

    // A user cannot report their own raffle
    if (raffle.creator && raffle.creator.toString() === req.user._id.toString()) {
      return res.redirect(`/raffles/${raffle.slug}?error=` + encodeURIComponent('No puedes reportar tu propio sorteo.'));
    }

    const report = new Report({
      raffle: raffle._id,
      user: req.user._id,
      reason
    });

    await report.save();

    res.redirect(`/raffles/${raffle.slug}?success=` + encodeURIComponent('Reporte enviado con éxito. El administrador revisará el caso.'));
  } catch (error) {
    console.error('Error reporting raffle:', error);
    res.redirect(`/raffles?error=` + encodeURIComponent('Error al enviar el reporte.'));
  }
};

