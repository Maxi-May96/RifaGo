import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
import { MERCADOPAGO } from '../config/env.js';
import Payment from '../models/Payment.js';
import Purchase from '../models/Purchase.js';
import Raffle from '../models/Raffle.js';
import NumberModel from '../models/Number.js';
import { emitToRaffle } from '../sockets/index.js';

let client = null;
if (MERCADOPAGO.accessToken) {
  client = new MercadoPagoConfig({
    accessToken: MERCADOPAGO.accessToken,
    options: { timeout: 5000 }
  });
}

/**
 * Handle Mercado Pago IPN / Webhook Notifications
 * POST /payments/webhook
 */
export const handleWebhook = async (req, res) => {
  try {
    const { action, data, type } = req.body;

    // Check if it's a payment topic/event
    if (type === 'payment' && (action === 'payment.created' || action === 'payment.updated' || req.query.topic === 'payment')) {
      const paymentId = data?.id || req.query.id;
      if (!paymentId) {
        return res.status(400).send('ID de pago faltante');
      }

      if (!client) {
        return res.status(500).send('Mercado Pago SDK no inicializado');
      }

      // Fetch payment status details directly from Mercado Pago API for safety
      const mpPayment = new MPPayment(client);
      const paymentDetail = await mpPayment.get({ id: paymentId });
      
      const externalReference = paymentDetail.external_reference;
      const status = paymentDetail.status;

      if (!externalReference) {
        return res.status(200).send('Sin external reference, ignorado.');
      }

      // 1. Check if externalReference corresponds to a Raffle Creation Payment
      const creationPayment = await Payment.findById(externalReference);
      if (creationPayment) {
        if (status === 'approved' && creationPayment.status !== 'approved') {
          creationPayment.status = 'approved';
          creationPayment.mpPaymentId = paymentId;
          creationPayment.mpStatus = status;
          await creationPayment.save();

          // Activate raffle
          const raffle = await Raffle.findById(creationPayment.raffle);
          if (raffle) {
            raffle.status = 'activo';
            raffle.creationPaid = true;
            raffle.creationPaymentId = paymentId;
            await raffle.save();
          }
        } else if ((status === 'rejected' || status === 'cancelled') && creationPayment.status === 'pending') {
          creationPayment.status = 'rejected';
          creationPayment.mpPaymentId = paymentId;
          creationPayment.mpStatus = status;
          await creationPayment.save();
        }
        
        return res.status(200).send('Webhook de pago de creación procesado correctamente.');
      }

      // 2. Check if externalReference corresponds to a Ticket Purchase
      const purchase = await Purchase.findById(externalReference).populate('raffle');
      if (purchase) {
        if (status === 'approved' && purchase.status !== 'completed') {
          purchase.status = 'completed';
          purchase.paymentId = paymentId;
          await purchase.save();

          // Confirm all ticket numbers as sold in Number Model
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

          // Notify live rooms
          emitToRaffle(purchase.raffle._id.toString(), 'numbers:sold', {
            numbers: purchase.numbers
          });
        } else if ((status === 'rejected' || status === 'cancelled') && purchase.status === 'pending') {
          // Revert reservation
          await NumberModel.deleteMany({ purchase: purchase._id });
          purchase.status = 'failed';
          purchase.paymentId = paymentId;
          await purchase.save();

          emitToRaffle(purchase.raffle._id.toString(), 'numbers:released', {
            numbers: purchase.numbers
          });
        }

        return res.status(200).send('Webhook de compra de boleto procesado correctamente.');
      }
    }

    // Default fallthrough response to MP
    res.status(200).send('Evento recibido pero no requirió acción.');
  } catch (error) {
    console.error('Error handling webhook callback:', error);
    res.status(500).send('Error interno al procesar el webhook.');
  }
};
