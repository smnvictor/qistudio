export default {
  async scheduled(controller, env) {
    const response = await fetch(new URL('/api/expiry', env.SITE_URL), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.EXPIRY_TOKEN },
      signal: AbortSignal.timeout(60000)
    });
    if (!response.ok) throw new Error('Booking expiry request failed (' + response.status + ')');
  }
};
