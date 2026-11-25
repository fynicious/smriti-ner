const INTL_LOCALE_MAP: Record<string, string> = {
  en: 'en-IN',
  as: 'as-IN',
  bn: 'bn-IN',
  mni: 'bn-IN',
  'mni-mymk': 'en-IN',
  ne: 'ne-NP',
  brx: 'hi-IN',
  kha: 'en-IN',
  lus: 'en-IN',
  grt: 'en-IN',
  njz: 'en-IN',
  adi: 'en-IN',
  clk: 'en-IN',
  njm: 'en-IN',
  njo: 'en-IN',
  sip: 'en-IN',
  trp: 'en-IN',
};

export function resolveIntlLocale(langCode: string): string {
  return INTL_LOCALE_MAP[langCode] || 'en-IN';
}

export function formatLocalizedDate(dateInput: Date | string | number, langCode = 'en'): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(resolveIntlLocale(langCode), {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

export function formatLocalizedTime(dateInput: Date | string | number, langCode = 'en'): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(resolveIntlLocale(langCode), {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toTimeString().slice(0, 5);
  }
}

export function formatLocalizedNumber(value: number, langCode = 'en'): string {
  try {
    return new Intl.NumberFormat(resolveIntlLocale(langCode)).format(value);
  } catch {
    return String(value);
  }
}
