import { expireBookings } from './_expiry.js';

export async function onRequest(context) {
  await expireBookings(context.env);
  return context.next();
}
