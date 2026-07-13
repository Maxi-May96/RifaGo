import { MercadoPagoConfig, Preference } from 'mercadopago';
import { MERCADOPAGO } from '../config/env.js';

let client = null;

if (MERCADOPAGO.accessToken) {
  client = new MercadoPagoConfig({
    accessToken: MERCADOPAGO.accessToken,
    options: { timeout: 5000 }
  });
}

/**
 * Create a payment preference link
 * @param {Object} paymentData
 * @param {string} paymentData.title - Title of the raffle/product
 * @param {number} paymentData.quantity - Quantity
 * @param {number} paymentData.unitPrice - Price per item
 * @param {string} paymentData.externalReference - Purchase/Booking ID reference
 * @param {string} paymentData.backUrlSuccess - Redirect URL on success
 * @param {string} paymentData.backUrlFailure - Redirect URL on failure
 * @returns {Promise<Object>} Preference response (contains init_point URL)
 */
export const createPreference = async ({
  title,
  quantity,
  unitPrice,
  externalReference,
  backUrlSuccess,
  backUrlFailure,
}) => {
  try {
    if (!client) {
      throw new Error('Mercado Pago Client is not initialized. Please configure MERCADOPAGO_ACCESS_TOKEN.');
    }

    const preference = new Preference(client);
    const response = await preference.create({
      body: {
        items: [
          {
            title: title,
            quantity: Number(quantity),
            unit_price: Number(unitPrice),
            currency_id: 'ARS', // Can be customized per region
          }
        ],
        back_urls: {
          success: backUrlSuccess,
          failure: backUrlFailure,
          pending: backUrlFailure,
        },
        auto_return: 'approved',
        external_reference: externalReference,
      }
    });

    return response;
  } catch (error) {
    console.error('Error in createPreference service:', error);
    throw error;
  }
};
