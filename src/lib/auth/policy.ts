/**
 * Account rules that can be switched in one place.
 *
 * EMAIL_VERIFICATION_REQUIRED is off for now: people can sign in and use the app before confirming their email.
 * Turn it back on before launch. The verify-email link still works either way, and sign-up still sends the email.
 * When it is on, signed-in pages send unverified users to /verify-email, and upgrading needs a verified email.
 */
export const EMAIL_VERIFICATION_REQUIRED = false;

/** Name of the session cookie. Kept in a plain module so the request proxy can read it. */
export const SESSION_COOKIE = "emulix_session";
