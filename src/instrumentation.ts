/** Runs once when the server starts: applies the deletion schedule now and then every six hours. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { purgeExpiredDesigns } = await import('@/lib/orders');
  const run = () => {
    try {
      purgeExpiredDesigns();
    } catch (error) {
      console.error('Deletion schedule failed', error);
    }
  };
  run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}
