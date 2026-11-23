// The site's switches. Each one is a single line to change when it's ready.

/** The launch switch. While false, Download and Buy both show "Coming soon". Flip it to go live. */
export const launched = true;

/** Direct download of the notarized app. */
const downloadLink = 'https://downloads.stillread.app/Stillread.dmg';

/** Polar checkout for the Editing unlock (success page: /thanks?checkout_id=…). */
const checkoutLink = 'https://buy.polar.sh/polar_cl_04iOjVhu9is8WQORMHEl96xDETII5omGfttQw2iZtbX';

export const downloadUrl = launched ? downloadLink : '';
export const checkoutUrl = launched ? checkoutLink : '';

/** Where support email goes. */
export const supportEmail = 'support@stillread.app';

/** Fathom site ID. Empty keeps analytics off. */
export const fathomSite = 'AWEUOVTD';

export const price = '$9.99';
export const minimumMacOS = 'macOS 14 Sonoma or later';

/** Polar's customer portal, where buyers find their key and manage their Macs. */
export const customerPortalUrl = 'https://polar.sh/cascadia-digital-inc/portal';

/**
 * Black Friday sale. Shown only between start and end (Vancouver time), so it switches itself
 * on and off with no deploy. To start it now instead of Friday, change `start` to today's date.
 * Add ?sale=preview to any URL to see it early; ?sale=off hides it.
 * The code has to exist in Polar (50% off the Editing product) for any of this to work.
 */
export const sale = {
    code: 'STILLBLACK50',
    start: '2026-11-27T00:00:00-08:00', // Friday, Nov 27, midnight in Vancouver
    end: '2026-11-30T00:00:00-08:00', // the end of Sunday, Nov 29 in Vancouver
    ends: 'Sunday, November 29',
};

/** The Buy link with the sale code filled in at checkout (Polar's `discount_code` prefill). */
export const saleCheckoutUrl = checkoutUrl ? `${checkoutUrl}?discount_code=${encodeURIComponent(sale.code)}` : '';
