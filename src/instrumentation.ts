/**
 * Runs once when the server starts: applies the deletion schedule now and then every six
 * hours. The same job asks the print partner (if set up) about orders sent to it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { purgeExpiredDesigns } = await import('@/lib/orders');
  const { pollPartnerOrders } = await import('@/lib/print-partner');
  const run = () => {
    try {
      purgeExpiredDesigns();
    } catch (error) {
      console.error('Deletion schedule failed', error);
    }
    pollPartnerOrders().catch((error) => console.error('Print partner status check failed', error));
  };
  run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}
