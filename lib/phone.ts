import { parsePhoneNumberFromString } from "libphonenumber-js/min";

export function normalizePhoneCountryCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 3);
  return digits ? `+${digits}` : "";
}

export function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

export function validateAndNormalizePhone(phoneCountryCode: string, phoneDigits: string) {
  const cc = normalizePhoneCountryCode(phoneCountryCode);
  const digits = normalizePhoneDigits(phoneDigits);
  if (!digits) return null;
  if (!cc) return null;

  const parsed = parsePhoneNumberFromString(`${cc}${digits}`);
  if (!parsed?.isValid()) return null;

  return {
    phoneCountryCode: `+${parsed.countryCallingCode}`,
    phone: parsed.nationalNumber,
    e164: parsed.number,
  };
}

