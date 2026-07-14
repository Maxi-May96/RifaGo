import Raffle from '../models/Raffle.js';
import Purchase from '../models/Purchase.js';
import NumberModel from '../models/Number.js';
import { createPreference } from '../services/payment.service.js';
import { uploadFile } from '../services/firebase.service.js';
import { emitToRaffle } from '../sockets/index.js';
import { APP_BASE_URL } from '../config/env.js';

/**
 * Periodically or on-demand clears expired reservations.
 * If status is 'reserved' and reservedUntil is in the past, delete them.
 */
export const cleanupExpiredReservations = async () => {
  try {
    const now = new Date();
    // Find expired reserved numbers
    const expiredNumbers = await NumberModel.find({
      status: 'reserved',
      reservedUntil: { $lt: now }
    });

    if (expiredNumbers.length > 0) {
      const expiredIds = expiredNumbers.map(n => n._id);
      const raffleGroups = {};

      expiredNumbers.forEach(n => {
        if (!raffleGroups[n.raffle]) {
          raffleGroups[n.raffle] = [];
        }
        raffleGroups[n.raffle].push(n.number);
      });

      // Delete expired reservations
      await NumberModel.deleteMany({ _id: { $in: expiredIds } });

      // Update associated Purchases to failed if all numbers were released
      const purchaseIds = [...new Set(expiredNumbers.map(n => n.purchase).filter(Boolean))];
      if (purchaseIds.length > 0) {
        await Purchase.updateMany(
          { _id: { $in: purchaseIds }, status: 'pending' },
          { $set: { status: 'failed' } }
        );
      }

      // Notify clients via Socket.IO for each raffle room
      for (const raffleId of Object.keys(raffleGroups)) {
        emitToRaffle(raffleId, 'numbers:released', {
          numbers: raffleGroups[raffleId]
        });
      }
    }
  } catch (error) {
    console.error('Error cleaning up expired reservations:', error);
  }
};

// POST process ticket purchase checkout
export const createPurchase = async (req, res) => {
  try {
    // Run cleanup first
    await cleanupExpiredReservations();

    const { raffleId, selectedNumbers, quantity } = req.body;
    
    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).send('Sorteo no encontrado');
    }

    if (raffle.status !== 'activo') {
      return res.status(400).send('El sorteo no está activo en este momento.');
    }

    const now = new Date();
    if (raffle.drawDate && now > new Date(raffle.drawDate)) {
      return res.status(400).send('El sorteo ya ha cerrado por haber alcanzado la fecha del sorteo.');
    }

    const qty = parseInt(quantity) || 1;
    let numbersToReserve = [];

    // Find taken numbers (reserved, pending, or sold)
    const activeReservations = await NumberModel.find({ raffle: raffleId });
    const takenNumbers = activeReservations.map(n => n.number);

    if (raffle.ticketSelectionMode === 'manual') {
      if (!selectedNumbers) {
        return res.status(400).send('Debe seleccionar al menos un número.');
      }
      // selectedNumbers is a comma-separated string or array
      numbersToReserve = Array.isArray(selectedNumbers) 
        ? selectedNumbers.map(Number)
        : selectedNumbers.split(',').map(Number);
      
      if (numbersToReserve.length === 0) {
        return res.status(400).send('Debe seleccionar al menos un número.');
      }

      // Check limits
      if (numbersToReserve.length > (raffle.maxPerBuyer || 10)) {
        return res.status(400).send(`Supera el límite permitido de ${raffle.maxPerBuyer} números por persona.`);
      }

      // Check conflict
      const hasConflict = numbersToReserve.some(num => takenNumbers.includes(num));
      if (hasConflict) {
        return res.status(400).send('Uno o más números seleccionados ya no están disponibles.');
      }
    } else {
      // Automatic Mode: Find random available numbers
      const availableNumbers = [];
      for (let i = 1; i <= raffle.totalTickets; i++) {
        if (!takenNumbers.includes(i)) {
          availableNumbers.push(i);
        }
      }

      if (availableNumbers.length < qty) {
        return res.status(400).send('No hay suficientes números disponibles.');
      }

      // Shuffle and select qty numbers
      const shuffled = availableNumbers.sort(() => 0.5 - Math.random());
      numbersToReserve = shuffled.slice(0, qty);
    }

    // Calculate total amount
    const amount = numbersToReserve.length * raffle.ticketPrice;

    // Create the Purchase record
    const newPurchase = new Purchase({
      user: req.user._id,
      raffle: raffleId,
      numbers: numbersToReserve,
      amount,
      status: 'pending',
      paymentMode: raffle.paymentMode || 'rifago'
    });

    await newPurchase.save();

    // Reserve numbers atomically in Number database
    const reservedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 min TTL
    
    try {
      const numbersDocs = numbersToReserve.map(num => ({
        raffle: raffleId,
        number: num,
        status: 'reserved',
        user: req.user._id,
        purchase: newPurchase._id,
        reservedUntil
      }));

      await NumberModel.insertMany(numbersDocs, { ordered: false });
    } catch (dbErr) {
      // Conflict: duplicate key, revert purchase and return error
      await Purchase.findByIdAndDelete(newPurchase._id);
      return res.status(409).send('Conflict: Uno o más números acaban de ser seleccionados por otro usuario. Intenta de nuevo.');
    }

    // Emit live socket reservation
    emitToRaffle(raffleId, 'numbers:reserved', {
      numbers: numbersToReserve,
      userId: req.user._id
    });

    // Handle payment mode redirection
    if (raffle.paymentMode === 'manual') {
      return res.redirect(`/purchases/manual-instructions/${newPurchase._id}`);
    } else {
      // Mercado Pago integration
      const preference = await createPreference({
        title: `Compra de boletos: ${raffle.title}`,
        quantity: 1,
        unitPrice: amount,
        externalReference: newPurchase._id.toString(),
        backUrlSuccess: `${APP_BASE_URL}/purchases/success`,
        backUrlFailure: `${APP_BASE_URL}/purchases/failure`
      });

      newPurchase.paymentId = preference.id; // Store preference ID
      await newPurchase.save();

      return res.redirect(preference.init_point);
    }
  } catch (error) {
    console.error('Error creating purchase:', error);
    res.status(500).send('Error interno al realizar la compra.');
  }
};

// GET /purchases/success (Mercado Pago redirect)
export const confirmPurchase = async (req, res) => {
  try {
    const { payment_id, status, external_reference } = req.query;

    const purchase = await Purchase.findById(external_reference).populate('raffle');
    if (!purchase) {
      return res.status(404).send('Compra no encontrada');
    }

    if (purchase.status === 'completed') {
      return res.redirect(`/purchases/success-page/${purchase._id}`);
    }

    if (status === 'approved' || req.query.collection_status === 'approved') {
      purchase.status = 'completed';
      purchase.paymentId = payment_id || purchase.paymentId;
      await purchase.save();

      // Confirm all ticket numbers as sold
      await NumberModel.updateMany(
        { purchase: purchase._id },
        { $set: { status: 'sold' }, $unset: { reservedUntil: "" } }
      );

      // Increment soldTickets in Raffle
      const raffle = purchase.raffle;
      if (raffle) {
        raffle.soldTickets = (raffle.soldTickets || 0) + purchase.numbers.length;
        await raffle.save();
      }

      // Notify room
      emitToRaffle(purchase.raffle._id.toString(), 'numbers:sold', {
        numbers: purchase.numbers
      });

      return res.redirect(`/purchases/success-page/${purchase._id}`);
    } else {
      // Revert reservation on failed payment
      await NumberModel.deleteMany({ purchase: purchase._id });
      purchase.status = 'failed';
      await purchase.save();

      emitToRaffle(purchase.raffle._id.toString(), 'numbers:released', {
        numbers: purchase.numbers
      });

      return res.redirect(`/raffles/${purchase.raffle.slug}?error=` + encodeURIComponent('El pago no fue aprobado.'));
    }
  } catch (error) {
    console.error('Error confirming purchase:', error);
    res.status(500).send('Error al procesar la confirmación del pago.');
  }
};

// GET /purchases/failure
export const purchaseFailed = async (req, res) => {
  try {
    const { external_reference } = req.query;
    if (external_reference) {
      const purchase = await Purchase.findById(external_reference).populate('raffle');
      if (purchase) {
        await NumberModel.deleteMany({ purchase: purchase._id });
        purchase.status = 'failed';
        await purchase.save();

        emitToRaffle(purchase.raffle._id.toString(), 'numbers:released', {
          numbers: purchase.numbers
        });

        return res.redirect(`/raffles/${purchase.raffle.slug}?error=` + encodeURIComponent('Pago cancelado.'));
      }
    }
    res.redirect('/raffles');
  } catch (error) {
    console.error('Error handling purchase failure:', error);
    res.redirect('/raffles');
  }
};

// GET /purchases/manual-instructions/:id
export const getManualInstructions = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id).populate('raffle');
    if (!purchase) {
      return res.status(404).send('Compra no encontrada');
    }

    res.render('purchases/manual_instructions', {
      title: 'Pago por Transferencia - RifaGo',
      purchase,
      raffle: purchase.raffle
    });
  } catch (error) {
    console.error('Error fetching manual instructions:', error);
    res.status(500).send('Error del servidor.');
  }
};

// POST /purchases/upload-proof/:id (Upload transfer proof receipt)
export const uploadTransferProof = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).send('Compra no encontrada');
    }

    const files = req.files || [];
    const proofFile = files.find(f => f.fieldname === 'transferProof');
    
    if (!proofFile) {
      return res.status(400).send('Por favor selecciona la imagen de tu comprobante.');
    }

    const proofUrl = await uploadFile(proofFile, 'comprobantes');
    if (!proofUrl) {
      return res.status(500).send('Error al subir el comprobante.');
    }

    purchase.transferProof = proofUrl;
    purchase.status = 'pending_payment'; // Waiting organizer verification
    await purchase.save();

    // Update reservation status to pending_payment
    await NumberModel.updateMany(
      { purchase: purchase._id },
      { $set: { status: 'pending_payment' } }
    );

    // Notify clients that purchase is waiting for approval
    emitToRaffle(purchase.raffle.toString(), 'purchase:pending_manual', {
      purchaseId: purchase._id,
      buyerName: req.user.name,
      numbers: purchase.numbers
    });

    res.redirect(`/purchases/manual-instructions/${purchase._id}`);
  } catch (error) {
    console.error('Error uploading transfer proof:', error);
    res.status(500).send('Error al procesar el comprobante.');
  }
};

// POST /purchases/manual-confirm/:id (Organizer confirms transfer payment)
export const confirmManualPurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id).populate('raffle');
    if (!purchase) {
      return res.status(404).send('Compra no encontrada');
    }

    // Authorization check: only raffle creator can confirm
    if (purchase.raffle.creator.toString() !== req.user._id.toString()) {
      return res.status(403).send('No autorizado.');
    }

    purchase.status = 'completed';
    purchase.confirmedBy = req.user._id;
    purchase.confirmedAt = new Date();
    await purchase.save();

    // Update tickets to sold
    await NumberModel.updateMany(
      { purchase: purchase._id },
      { $set: { status: 'sold' }, $unset: { reservedUntil: "" } }
    );

    // Increment raffle sold tickets
    const raffle = purchase.raffle;
    raffle.soldTickets = (raffle.soldTickets || 0) + purchase.numbers.length;
    await raffle.save();

    // Emit live sold update
    emitToRaffle(raffle._id.toString(), 'numbers:sold', {
      numbers: purchase.numbers
    });

    emitToRaffle(raffle._id.toString(), 'purchase:confirmed_manual', {
      purchaseId: purchase._id,
      numbers: purchase.numbers
    });

    res.redirect('/raffles/myraffles?success=' + encodeURIComponent('Pago confirmado correctamente. Los números se asignaron al comprador.'));
  } catch (error) {
    console.error('Error confirming manual purchase:', error);
    res.status(500).send('Error interno del servidor.');
  }
};

// POST /purchases/manual-reject/:id (Organizer rejects/releases manual purchase)
export const rejectManualPurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id).populate('raffle');
    if (!purchase) {
      return res.status(404).send('Compra no encontrada');
    }

    if (purchase.raffle.creator.toString() !== req.user._id.toString()) {
      return res.status(403).send('No autorizado.');
    }

    // Delete reserved numbers to free them
    await NumberModel.deleteMany({ purchase: purchase._id });

    purchase.status = 'failed';
    await purchase.save();

    emitToRaffle(purchase.raffle._id.toString(), 'numbers:released', {
      numbers: purchase.numbers
    });

    res.redirect('/raffles/myraffles?error=' + encodeURIComponent('El pago fue rechazado y los números fueron liberados.'));
  } catch (error) {
    console.error('Error rejecting manual purchase:', error);
    res.status(500).send('Error interno del servidor.');
  }
};

// GET /purchases/success-page/:id (Show receipt of purchase)
export const getSuccessPage = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id).populate('raffle');
    if (!purchase) {
      return res.status(404).send('Compra no encontrada');
    }

    res.render('purchases/success', {
      title: 'Compra Exitosa - RifaGo',
      purchase,
      raffle: purchase.raffle
    });
  } catch (error) {
    console.error('Error rendering success page:', error);
    res.status(500).send('Error del servidor.');
  }
};
