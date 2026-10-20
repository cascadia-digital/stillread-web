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
