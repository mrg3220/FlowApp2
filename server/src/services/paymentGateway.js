/**
 * Payment Gateway Adapter Service
 *
 * Pluggable provider interface — each school configures their own
 * Stripe or Square account. The gateway is resolved at runtime from
 * the school's PaymentConfig record.
 *
 * When no gateway SDK is installed yet (or config.isActive is false),
 * all charge/refund calls gracefully return a "manual" result.
 */

// ─── Stripe Adapter ──────────────────────────────────────

const stripeAdapter = {
  /**
   * Create a one-time charge via Stripe.
   * @param {object} config - PaymentConfig row (has gatewaySecretKey)
   * @param {object} params - { amount, currency, description, token }
   */
  async charge(config, { amount, currency, description, token }) {
    try {
      const stripe = require('stripe')(config.gatewaySecretKey);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // cents
        currency: currency || config.currency || 'usd',
        description,
        payment_method: token,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      });
      return {
        success: true,
        transactionId: paymentIntent.id,
        status: paymentIntent.status,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async refund(config, { transactionId, amount }) {
    try {
      const stripe = require('stripe')(config.gatewaySecretKey);
      const refund = await stripe.refunds.create({
        payment_intent: transactionId,
        ...(amount && { amount: Math.round(amount * 100) }),
      });
      return { success: true, refundId: refund.id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
};

// ─── Square Adapter ──────────────────────────────────────

const squareAdapter = {
  async charge(config, { amount, currency, description, token }) {
    try {
      const { Client, Environment } = require('square');
      const client = new Client({
        accessToken: config.gatewaySecretKey,
        environment: Environment.Production,
      });
      const { result } = await client.paymentsApi.createPayment({
        sourceId: token,
        amountMoney: {
          amount: BigInt(Math.round(amount * 100)),
          currency: (currency || config.currency || 'USD').toUpperCase(),
        },
        locationId: config.gatewayMerchantId,
        idempotencyKey: require('crypto').randomUUID(),
        note: description,
      });
      return {
        success: true,
        transactionId: result.payment.id,
        status: result.payment.status,
      };
    } catch (err) {
      return { success: false, error: err.message || 'Square payment failed' };
    }
  },

  async refund(config, { transactionId, amount }) {
    try {
      const { Client, Environment } = require('square');
      const client = new Client({
        accessToken: config.gatewaySecretKey,
        environment: Environment.Production,
      });
      const { result } = await client.refundsApi.refundPayment({
        paymentId: transactionId,
        idempotencyKey: require('crypto').randomUUID(),
        amountMoney: amount
          ? {
              amount: BigInt(Math.round(amount * 100)),
              currency: (config.currency || 'USD').toUpperCase(),
            }
          : undefined,
      });
      return { success: true, refundId: result.refund.id };
    } catch (err) {
      return { success: false, error: err.message || 'Square refund failed' };
    }
  },
};

// ─── Manual (no gateway) ─────────────────────────────────

const manualAdapter = {
  async charge(_config, { amount }) {
    return {
      success: true,
      transactionId: `MANUAL-${Date.now()}`,
      status: 'recorded',
      note: 'Manual payment — no gateway processed',
    };
  },
  async refund(_config, { transactionId }) {
    return {
      success: true,
      refundId: `MANUAL-REFUND-${Date.now()}`,
    };
  },
};

// ─── Resolver ────────────────────────────────────────────

const adapters = {
  STRIPE: stripeAdapter,
  SQUARE: squareAdapter,
  MANUAL: manualAdapter,
};

/**
 * Resolve the adapter for a school's gateway.
 * Falls back to manual if gateway is not configured or not active.
 */
function getAdapter(paymentConfig) {
  if (!paymentConfig || !paymentConfig.isActive) {
    return manualAdapter;
  }
  return adapters[paymentConfig.gateway] || manualAdapter;
}

module.exports = { getAdapter, adapters };
