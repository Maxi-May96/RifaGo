import { MercadoPagoConfig, Preference } from 'mercadopago';
import { MERCADOPAGO, APP_BASE_URL } from '../config/env.js';

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
    
    const successUrl = backUrlSuccess && !backUrlSuccess.includes('undefined') 
      ? backUrlSuccess 
      : `${APP_BASE_URL}/`;
      
    const failureUrl = backUrlFailure && !backUrlFailure.includes('undefined') 
      ? backUrlFailure 
      : `${APP_BASE_URL}/`;

    // Mercado Pago webhook URL path
    const webhookUrl = `${APP_BASE_URL}/payments/webhook`;

    const body = {
      items: [
        {
          title: title,
          quantity: Number(quantity),
          unit_price: Number(unitPrice),
          currency_id: 'ARS',
        }
      ],
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: failureUrl,
      },
      auto_return: 'approved',
      external_reference: externalReference,
    };

    // Mercado Pago only accepts HTTPS/public URLs for notification_url.
    // If running on localhost/127.0.0.1, omit it to avoid preference creation errors.
    if (!webhookUrl.includes('localhost') && !webhookUrl.includes('127.0.0.1')) {
      body.notification_url = webhookUrl;
    }

    const response = await preference.create({ body });

    return response;
  } catch (error) {
    console.error('Error in createPreference service:', error);
    throw error;
  }
};
