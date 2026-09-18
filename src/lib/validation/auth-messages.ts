/**
 * Shared, user-facing validation copy for the auth forms.
 *
 * Kept in one module so the login, signup and reset-password screens cannot drift
 * apart, and so the copy is defined once rather than repeated at each check site.
 */
export const AUTH_MESSAGES = {
  passwordRequired: "Enter your password.",
  passwordMinLength: "Use at least 6 characters.",
} as const;
