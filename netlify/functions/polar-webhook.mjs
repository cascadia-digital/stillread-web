// Netlify Function: https://stillread.app/.netlify/functions/polar-webhook
// Polar calls this when someone buys the Editing unlock. The logic lives in ../lib/polar-kit.mjs.
import { createHandler } from '../lib/polar-kit.mjs';

export default createHandler();
