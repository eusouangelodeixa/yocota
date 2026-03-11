const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string; decimals: number }> = {
  brl: { symbol: "R$", locale: "pt-BR", decimals: 2 },
  usd: { symbol: "$", locale: "en-US", decimals: 2 },
  eur: { symbol: "€", locale: "de-DE", decimals: 2 },
  gbp: { symbol: "£", locale: "en-GB", decimals: 2 },
  ars: { symbol: "ARS", locale: "es-AR", decimals: 2 },
  mxn: { symbol: "MX$", locale: "es-MX", decimals: 2 },
  clp: { symbol: "CLP", locale: "es-CL", decimals: 0 },
  cop: { symbol: "COP", locale: "es-CO", decimals: 0 },
  pen: { symbol: "S/", locale: "es-PE", decimals: 2 },
  uyu: { symbol: "UYU", locale: "es-UY", decimals: 2 },
  cad: { symbol: "CA$", locale: "en-CA", decimals: 2 },
  aud: { symbol: "A$", locale: "en-AU", decimals: 2 },
  jpy: { symbol: "¥", locale: "ja-JP", decimals: 0 },
  inr: { symbol: "₹", locale: "en-IN", decimals: 2 },
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_CONFIG);

export function getCurrencyLabel(code: string): string {
  const labels: Record<string, string> = {
    brl: "BRL – Real Brasileiro",
    usd: "USD – Dólar Americano",
    eur: "EUR – Euro",
    gbp: "GBP – Libra Esterlina",
    ars: "ARS – Peso Argentino",
    mxn: "MXN – Peso Mexicano",
    clp: "CLP – Peso Chileno",
    cop: "COP – Peso Colombiano",
    pen: "PEN – Sol Peruano",
    uyu: "UYU – Peso Uruguaio",
    cad: "CAD – Dólar Canadense",
    aud: "AUD – Dólar Australiano",
    jpy: "JPY – Iene Japonês",
    inr: "INR – Rúpia Indiana",
  };
  return labels[code] || code.toUpperCase();
}

export function formatCents(cents: number, currency = "eur"): string {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.eur;
  const value = cents / Math.pow(10, config.decimals);
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(value);
}

// Keep backward compat
export function formatCentsToBRL(cents: number): string {
  return formatCents(cents, "brl");
}

export function parsePriceToCents(value: string, currency = "eur"): number {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.brl;
  const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
  return Math.round(parseFloat(cleaned) * Math.pow(10, config.decimals));
}

export function parseBRLToCents(value: string): number {
  return parsePriceToCents(value, "brl");
}

export function isZeroDecimalCurrency(currency: string): boolean {
  const config = CURRENCY_CONFIG[currency];
  return config ? config.decimals === 0 : false;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
