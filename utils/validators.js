/* Shared validation helpers used across the doctor / invoice / prescription routes.
   Each `isX` helper returns a boolean. `collectErrors` lets a route build up a list
   of field-level problems and return them all at once (instead of failing fast on
   the first bad field), which is friendlier for a form with many inputs. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Standard 10-character Indian PAN: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;

// Standard 15-character Indian GSTIN: 2 digit state code, PAN, 1 entity code,
// literal 'Z', 1 checksum character (e.g. 27ABCDE1234F1Z5)
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;

// UPI VPA: alphanumeric/./-/_ handle, @, then the bank/PSP handle
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-_]{1,64}$/;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value) {
  return isNonEmptyString(value) && EMAIL_RE.test(value.trim());
}

function isValidPassword(value, minLength = 8) {
  return typeof value === "string" && value.length >= minLength;
}

function isValidPAN(value) {
  return isNonEmptyString(value) && PAN_RE.test(value.trim());
}

function isValidGST(value) {
  return isNonEmptyString(value) && GST_RE.test(value.trim());
}

function isValidUPI(value) {
  return isNonEmptyString(value) && UPI_RE.test(value.trim());
}

// Accepts numbers or numeric strings; rejects "", null, undefined, NaN, and negatives.
function isNonNegativeNumber(value) {
  if (value === "" || value === null || value === undefined) return false;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0;
}

function isPositiveNumber(value) {
  if (value === "" || value === null || value === undefined) return false;
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

class ValidationErrors {
  constructor() {
    this.errors = {};
  }

  add(field, message) {
    if (!this.errors[field]) this.errors[field] = message;
  }

  get hasErrors() {
    return Object.keys(this.errors).length > 0;
  }

  // First error message, handy for a single-line toast/banner on the frontend.
  get firstMessage() {
    const keys = Object.keys(this.errors);
    return keys.length ? this.errors[keys[0]] : null;
  }

  toJSON() {
    return { error: this.firstMessage, fieldErrors: this.errors };
  }
}

module.exports = {
  EMAIL_RE,
  PAN_RE,
  GST_RE,
  UPI_RE,
  isNonEmptyString,
  isValidEmail,
  isValidPassword,
  isValidPAN,
  isValidGST,
  isValidUPI,
  isNonNegativeNumber,
  isPositiveNumber,
  ValidationErrors
};
