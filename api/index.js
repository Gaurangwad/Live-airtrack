// Vercel serverless entry point. @vercel/node treats a default-exported
// Express app as the request handler. All data is fetched/computed per
// request (see server/store.js refreshIfStale), so no background process is
// required. Note: live AIS ship data needs a persistent WebSocket and is not
// available on serverless — ships fall back to the simulator here.
import app from '../server/app.js';

export default app;
