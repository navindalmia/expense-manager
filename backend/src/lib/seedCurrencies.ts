export interface SeedCurrency {
  code: string;
  label: string;
}

export const SEED_CURRENCIES: SeedCurrency[] = [
  { code: 'GBP', label: 'British Pound' },
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'HKD', label: 'Hong Kong Dollar' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'NZD', label: 'New Zealand Dollar' },
  { code: 'SEK', label: 'Swedish Krona' },
];
