/** Shared Brazilian phone rules used by account, lead and professional-profile flows. */
export const BR_PHONE_PATTERN = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
export const E164_PHONE_PATTERN = /^\+55\d{10,11}$/;

export function formatPhoneToE164(rawPhone: string): string {
  return `+55${rawPhone.replace(/\D/g, '')}`;
}

export function formatE164ToBRPhone(e164Phone: string): string {
  const match = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164Phone);
  if (!match) return '';
  const [, ddd, prefix, suffix] = match;
  return `(${ddd}) ${prefix}-${suffix}`;
}

export function isValidE164Phone(value: string | null): value is string {
  return value !== null && E164_PHONE_PATTERN.test(value);
}

export function maskBRPhone(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
