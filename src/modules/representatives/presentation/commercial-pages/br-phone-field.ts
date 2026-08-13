/**
 * Ported verbatim from every commercial-pages template's own inline
 * `<script>` (`normalizeDigits`/`maskPhone`/`validaTelefone`/`DDDS`,
 * identical across all 7 — confirmed by grep). This is a stricter, live-hint
 * validator than the app's own `BR_PHONE_PATTERN` regex
 * (`modules/leads/domain/lead-rules.ts`): it checks the digit actually maps
 * to a real DDD and that mobile numbers have the leading `9`, and it drives
 * the "Número válido ✓" / "Faltam N dígitos" / "DDD inválido" hint text the
 * templates show as the visitor types — none of which the regex alone can
 * express. `formatPhoneToE164` (`lead-rules.ts`) remains the source of truth
 * for what actually gets submitted; this only gates the live UI feedback and
 * client-side submit guard, matching what the templates' own script did.
 */

const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44,
  45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81,
  82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Normaliza o que o visitante cola: "+55 41 9...", "041 9..." e variações
 * chegavam antes como número inválido que PASSAVA na validação — o lead
 * entrava com um telefone inexistente e se perdia silenciosamente.
 */
export function normalizeDigits(value: string): string {
  let d = String(value).replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length > 11 && d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 11);
}

export function maskPhone(value: string): string {
  const d = normalizeDigits(value);
  if (!d.length) return '';
  if (d.length <= 2) return '(' + d;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (resto.length <= 8) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5, 9)}`;
}

export type PhoneValidation = { ok: true; e164: string } | { ok: false; erro: string };

export function validaTelefone(value: string): PhoneValidation {
  const d = normalizeDigits(value);
  if (d.length !== 10 && d.length !== 11) return { ok: false, erro: 'Digite DDD + número' };
  if (!DDDS.has(Number(d.slice(0, 2)))) return { ok: false, erro: 'DDD inválido' };
  if (d.length === 11 && d[2] !== '9') return { ok: false, erro: 'Celular deve começar com 9 após o DDD' };
  if (d.length === 10 && d[2] === '9') return { ok: false, erro: 'Falta 1 dígito no celular' };
  if (/^(\d)\1+$/.test(d.slice(2))) return { ok: false, erro: 'Número inválido' };
  return { ok: true, e164: '55' + d };
}

/**
 * Live hint text for the phone field as the visitor types — mirrors
 * `validatePhoneLive()` in the templates' own script exactly, including the
 * "Faltam N dígitos" partial-input state no regex-only approach expresses.
 */
export function phoneFieldHint(rawValue: string): { state: 'empty' | 'partial' | 'valid' | 'invalid'; message: string } {
  const digits = normalizeDigits(rawValue);
  if (digits.length === 0) return { state: 'empty', message: '' };
  const result = validaTelefone(rawValue);
  if (result.ok) return { state: 'valid', message: 'Número válido ✓' };
  if (digits.length < 10) return { state: 'partial', message: `Faltam ${10 - digits.length} dígitos` };
  return { state: 'invalid', message: result.erro };
}
