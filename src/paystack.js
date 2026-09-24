import { createHmac, timingSafeEqual } from 'node:crypto';

const API = 'https://api.paystack.co';

export class PaystackError extends Error {}

export function createPaystackClient(secretKey, { fetchImpl = fetch } = {}) {
  async function call(method, path, body) {
    if (!secretKey) throw new PaystackError('Payments are not configured yet (PAYSTACK_SECRET_KEY is missing).');
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status !== true) {
      throw new PaystackError(json.message || `Paystack request failed (${res.status})`);
    }
    return json.data;
  }

  return {
    /** Starts a checkout. Resolves to { authorization_url, access_code, reference }. */
    initialize({ email, amount, reference, callbackUrl, metadata }) {
      return call('POST', '/transaction/initialize', {
        email,
        amount,
        currency: 'GHS',
        reference,
        callback_url: callbackUrl,
        metadata,
      });
    },

    /** Resolves to the transaction; `status === 'success'` means it was paid. */
    verify(reference) {
      return call('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
    },

    /** Paystack signs webhooks with an HMAC-SHA512 of the raw body, keyed by the secret key. */
    isValidSignature(rawBody, signature) {
      if (!secretKey || typeof signature !== 'string') return false;
      const expected = createHmac('sha512', secretKey).update(rawBody).digest();
      const given = Buffer.from(signature, 'hex');
      return given.length === expected.length && timingSafeEqual(given, expected);
    },
  };
}
