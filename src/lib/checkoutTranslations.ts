export type CheckoutLang = "pt" | "en" | "es" | "fr" | "de" | "it" | "nl" | "pl" | "ru" | "ja" | "ko" | "zh" | "ar" | "tr" | "sv" | "da" | "no" | "fi";

export interface CheckoutTranslations {
  paymentInfo: string;
  contactInfo: string;
  fullName: string;
  fullNamePlaceholder: string;
  cardholderName: string;
  cardholderNamePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  whatsapp: string;
  phonePlaceholder: string;
  cardDetails: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
  orPayWithCard: string;
  securePayment: string;
  total: string;
  nameRequired: string;
  nameMinLength: string;
  emailRequired: string;
  emailInvalid: string;
  phoneRequired: string;
  phoneTooShort: string;
  fillAllFields: string;
  cardLoadError: string;
  notFound: string;
  notFoundDesc: string;
  defaultCta: string;
}

const pt: CheckoutTranslations = {
  paymentInfo: "Informações de pagamento",
  contactInfo: "Informações de contacto",
  fullName: "Nome completo",
  fullNamePlaceholder: "Digite seu nome",
  cardholderName: "Nome no cartão",
  cardholderNamePlaceholder: "Nome completo no cartão",
  email: "Email",
  emailPlaceholder: "seu@email.com",
  whatsapp: "WhatsApp",
  phonePlaceholder: "(11) 99999-9999",
  cardDetails: "Informações do cartão",
  cardNumber: "Número do cartão",
  expiry: "MM / AA",
  cvc: "CVC",
  orPayWithCard: "Ou pague com cartão",
  securePayment: "Pagamento processado com segurança via Stripe",
  total: "Total",
  nameRequired: "Nome é obrigatório",
  nameMinLength: "Nome deve ter pelo menos 3 caracteres",
  emailRequired: "Email é obrigatório",
  emailInvalid: "Email inválido",
  phoneRequired: "WhatsApp é obrigatório",
  phoneTooShort: "Número muito curto",
  fillAllFields: "Preencha todos os campos corretamente",
  cardLoadError: "Erro ao carregar campo de cartão",
  notFound: "Página não encontrada",
  notFoundDesc: "Este checkout não existe ou foi desativado.",
  defaultCta: "Finalizar compra",
};

const en: CheckoutTranslations = {
  paymentInfo: "Payment information",
  contactInfo: "Contact information",
  fullName: "Full name",
  fullNamePlaceholder: "Enter your name",
  cardholderName: "Cardholder name",
  cardholderNamePlaceholder: "Full name on card",
  email: "Email",
  emailPlaceholder: "you@email.com",
  whatsapp: "WhatsApp",
  phonePlaceholder: "(555) 123-4567",
  cardDetails: "Card information",
  cardNumber: "Card number",
  expiry: "MM / YY",
  cvc: "CVC",
  orPayWithCard: "Or pay with card",
  securePayment: "Payment securely processed via Stripe",
  total: "Total",
  nameRequired: "Name is required",
  nameMinLength: "Name must be at least 3 characters",
  emailRequired: "Email is required",
  emailInvalid: "Invalid email",
  phoneRequired: "WhatsApp is required",
  phoneTooShort: "Number too short",
  fillAllFields: "Please fill all fields correctly",
  cardLoadError: "Error loading card field",
  notFound: "Page not found",
  notFoundDesc: "This checkout does not exist or has been deactivated.",
  defaultCta: "Complete purchase",
};

const es: CheckoutTranslations = {
  paymentInfo: "Información de pago",
  contactInfo: "Información de contacto",
  fullName: "Nombre completo",
  fullNamePlaceholder: "Ingrese su nombre",
  cardholderName: "Nombre del titular",
  cardholderNamePlaceholder: "Nombre completo en la tarjeta",
  email: "Correo electrónico",
  emailPlaceholder: "tu@email.com",
  whatsapp: "WhatsApp",
  phonePlaceholder: "(11) 99999-9999",
  cardDetails: "Información de la tarjeta",
  cardNumber: "Número de tarjeta",
  expiry: "MM / AA",
  cvc: "CVC",
  orPayWithCard: "O pagar con tarjeta",
  securePayment: "Pago procesado de forma segura a través de Stripe",
  total: "Total",
  nameRequired: "El nombre es obligatorio",
  nameMinLength: "El nombre debe tener al menos 3 caracteres",
  emailRequired: "El correo es obligatorio",
  emailInvalid: "Correo inválido",
  phoneRequired: "WhatsApp es obligatorio",
  phoneTooShort: "Número demasiado corto",
  fillAllFields: "Complete todos los campos correctamente",
  cardLoadError: "Error al cargar el campo de tarjeta",
  notFound: "Página no encontrada",
  notFoundDesc: "Este checkout no existe o ha sido desactivado.",
  defaultCta: "Finalizar compra",
};

const fr: CheckoutTranslations = {
  paymentInfo: "Informations de paiement",
  contactInfo: "Informations de contact",
  fullName: "Nom complet",
  fullNamePlaceholder: "Entrez votre nom",
  cardholderName: "Nom du titulaire",
  cardholderNamePlaceholder: "Nom complet sur la carte",
  email: "E-mail",
  emailPlaceholder: "vous@email.com",
  whatsapp: "WhatsApp",
  phonePlaceholder: "06 12 34 56 78",
  cardDetails: "Informations de la carte",
  cardNumber: "Numéro de carte",
  expiry: "MM / AA",
  cvc: "CVC",
  orPayWithCard: "Ou payer par carte",
  securePayment: "Paiement sécurisé via Stripe",
  total: "Total",
  nameRequired: "Le nom est obligatoire",
  nameMinLength: "Le nom doit comporter au moins 3 caractères",
  emailRequired: "L'e-mail est obligatoire",
  emailInvalid: "E-mail invalide",
  phoneRequired: "WhatsApp est obligatoire",
  phoneTooShort: "Numéro trop court",
  fillAllFields: "Veuillez remplir tous les champs correctement",
  cardLoadError: "Erreur de chargement du champ carte",
  notFound: "Page non trouvée",
  notFoundDesc: "Ce checkout n'existe pas ou a été désactivé.",
  defaultCta: "Finaliser l'achat",
};

const de: CheckoutTranslations = {
  paymentInfo: "Zahlungsinformationen",
  contactInfo: "Kontaktinformationen",
  fullName: "Vollständiger Name",
  fullNamePlaceholder: "Geben Sie Ihren Namen ein",
  cardholderName: "Name des Karteninhabers",
  cardholderNamePlaceholder: "Vollständiger Name auf der Karte",
  email: "E-Mail",
  emailPlaceholder: "ihre@email.com",
  whatsapp: "WhatsApp",
  phonePlaceholder: "0170 1234567",
  cardDetails: "Karteninformationen",
  cardNumber: "Kartennummer",
  expiry: "MM / JJ",
  cvc: "CVC",
  orPayWithCard: "Oder mit Karte bezahlen",
  securePayment: "Zahlung sicher verarbeitet über Stripe",
  total: "Gesamt",
  nameRequired: "Name ist erforderlich",
  nameMinLength: "Name muss mindestens 3 Zeichen lang sein",
  emailRequired: "E-Mail ist erforderlich",
  emailInvalid: "Ungültige E-Mail",
  phoneRequired: "WhatsApp ist erforderlich",
  phoneTooShort: "Nummer zu kurz",
  fillAllFields: "Bitte füllen Sie alle Felder korrekt aus",
  cardLoadError: "Fehler beim Laden des Kartenfelds",
  notFound: "Seite nicht gefunden",
  notFoundDesc: "Dieser Checkout existiert nicht oder wurde deaktiviert.",
  defaultCta: "Kauf abschließen",
};

const it: CheckoutTranslations = {
  paymentInfo: "Informazioni di pagamento",
  fullName: "Nome completo",
  fullNamePlaceholder: "Inserisci il tuo nome",
  email: "Email",
  emailPlaceholder: "tua@email.com",
  whatsapp: "WhatsApp",
  phonePlaceholder: "333 123 4567",
  cardDetails: "Dati della carta",
  cardNumber: "Numero della carta",
  expiry: "MM / AA",
  cvc: "CVC",
  securePayment: "Pagamento elaborato in sicurezza tramite Stripe",
  total: "Totale",
  nameRequired: "Il nome è obbligatorio",
  nameMinLength: "Il nome deve avere almeno 3 caratteri",
  emailRequired: "L'email è obbligatoria",
  emailInvalid: "Email non valida",
  phoneRequired: "WhatsApp è obbligatorio",
  phoneTooShort: "Numero troppo corto",
  fillAllFields: "Compila tutti i campi correttamente",
  cardLoadError: "Errore nel caricamento del campo carta",
  notFound: "Pagina non trovata",
  notFoundDesc: "Questo checkout non esiste o è stato disattivato.",
  defaultCta: "Completa l'acquisto",
};

const nl: CheckoutTranslations = {
  paymentInfo: "Betalingsgegevens",
  fullName: "Volledige naam",
  fullNamePlaceholder: "Voer uw naam in",
  email: "E-mail",
  emailPlaceholder: "uw@email.com",
  whatsapp: "WhatsApp",
  phonePlaceholder: "06 12345678",
  cardDetails: "Kaartgegevens",
  cardNumber: "Kaartnummer",
  expiry: "MM / JJ",
  cvc: "CVC",
  securePayment: "Betaling veilig verwerkt via Stripe",
  total: "Totaal",
  nameRequired: "Naam is verplicht",
  nameMinLength: "Naam moet minimaal 3 tekens bevatten",
  emailRequired: "E-mail is verplicht",
  emailInvalid: "Ongeldig e-mailadres",
  phoneRequired: "WhatsApp is verplicht",
  phoneTooShort: "Nummer te kort",
  fillAllFields: "Vul alle velden correct in",
  cardLoadError: "Fout bij laden van kaartveld",
  notFound: "Pagina niet gevonden",
  notFoundDesc: "Deze checkout bestaat niet of is gedeactiveerd.",
  defaultCta: "Aankoop voltooien",
};

const translations: Record<string, CheckoutTranslations> = { pt, en, es, fr, de, it, nl };

// Map country codes to language
const COUNTRY_TO_LANG: Record<string, CheckoutLang> = {
  // Portuguese
  BR: "pt", PT: "pt", AO: "pt", MZ: "pt", CV: "pt", GW: "pt", ST: "pt", TL: "pt",
  // Spanish
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es", SV: "es", NI: "es", CR: "es", PA: "es", UY: "es", PR: "es",
  // French
  FR: "fr", BE: "fr", CH: "fr", CA: "fr", SN: "fr", CI: "fr", CM: "fr", MG: "fr", ML: "fr", BF: "fr", NE: "fr", TD: "fr", GN: "fr", RW: "fr", HT: "fr", BJ: "fr", TG: "fr", CD: "fr", CG: "fr", GA: "fr", DJ: "fr", KM: "fr", LU: "fr", MC: "fr",
  // German
  DE: "de", AT: "de", LI: "de",
  // Italian
  IT: "it", SM: "it", VA: "it",
  // Dutch
  NL: "nl", SR: "nl", AW: "nl", CW: "nl", SX: "nl",
  // English (default fallback, but explicit)
  US: "en", GB: "en", AU: "en", NZ: "en", IE: "en", ZA: "en", NG: "en", GH: "en", KE: "en", TZ: "en", UG: "en", JM: "en", TT: "en", PH: "en", SG: "en", IN: "en", PK: "en", BD: "en", MY: "en", HK: "en",
};

// Stripe locale mapping
const LANG_TO_STRIPE_LOCALE: Record<string, string> = {
  pt: "pt-BR", en: "en", es: "es", fr: "fr", de: "de", it: "it", nl: "nl",
};

export function getLangFromCountry(countryCode: string): CheckoutLang {
  return COUNTRY_TO_LANG[countryCode] || "en";
}

export function getTranslations(lang: CheckoutLang): CheckoutTranslations {
  return translations[lang] || translations.en;
}

export function getStripeLocale(lang: CheckoutLang): string {
  return LANG_TO_STRIPE_LOCALE[lang] || "en";
}
