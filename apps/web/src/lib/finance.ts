import {
  Apple,
  Award,
  Baby,
  BadgeDollarSign,
  BriefcaseBusiness,
  Bus,
  CalendarDays,
  Carrot,
  ChartNoAxesCombined,
  CircleEllipsis,
  Clapperboard,
  Clock,
  Coffee,
  Cookie,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  PawPrint,
  Percent,
  Plane,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  Utensils,
  Wallet,
  Wrench,
} from "lucide-react";
export const expenseCategories = [
  "food",
  "travel",
  "shopping",
  "bills",
  "rent",
  "phone",
  "beauty",
  "clothing",
  "fuel",
  "gifts",
  "electronics",
  "snacks",
  "drinks",
  "vegetables",
  "fruits",
  "repairs",
  "health",
  "education",
  "entertainment",
  "groceries",
  "transport",
  "insurance",
  "subscriptions",
  "fitness",
  "pets",
  "childcare",
  "donations",
  "taxes",
  "other",
] as const;
export const incomeSources = [
  "salary",
  "pocket-money",
  "gift",
  "investment",
  "bonus",
  "part-time",
  "freelance",
  "business",
  "rental",
  "interest",
  "dividends",
  "refund",
  "pension",
  "sale",
  "other",
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];
export type IncomeSource = (typeof incomeSources)[number];
const categoryIcons: Record<string, typeof Wallet> = {
  food: Utensils,
  travel: Plane,
  shopping: ShoppingBag,
  bills: Receipt,
  rent: House,
  phone: Smartphone,
  beauty: Sparkles,
  clothing: Shirt,
  fuel: Fuel,
  gifts: Gift,
  electronics: Laptop,
  snacks: Cookie,
  drinks: Coffee,
  vegetables: Carrot,
  fruits: Apple,
  repairs: Wrench,
  health: HeartPulse,
  education: GraduationCap,
  entertainment: Clapperboard,
  groceries: ShoppingCart,
  transport: Bus,
  insurance: ShieldCheck,
  subscriptions: CalendarDays,
  fitness: Dumbbell,
  pets: PawPrint,
  childcare: Baby,
  donations: HeartHandshake,
  taxes: Landmark,
  other: CircleEllipsis,
  salary: BriefcaseBusiness,
  "pocket-money": Wallet,
  gift: Gift,
  investment: TrendingUp,
  bonus: Award,
  "part-time": Clock,
  freelance: Laptop,
  business: Store,
  rental: House,
  interest: Percent,
  dividends: ChartNoAxesCombined,
  refund: RotateCcw,
  pension: Landmark,
  sale: BadgeDollarSign,
  invesment: TrendingUp,
  bonues: Award,
};
export function categoryIcon(category?: string | null) {
  return categoryIcons[category ?? "other"] ?? CircleEllipsis;
}
export const themes = [
  "light",
  "dark",
  "ocean",
  "forest",
  "sunset",
  "rose",
] as const;
export type ThemeName = (typeof themes)[number];
export type Preferences = { currency: string; theme: ThemeName };
export const palettes = {
  light: {
    background: "#f8fafc",
    card: "#ffffff",
    foreground: "#172033",
    muted: "#e8edf4",
    subtle: "#566479",
    border: "#cbd5e1",
    primary: "#4d7c0f",
    onPrimary: "#ffffff",
  },
  dark: {
    background: "#090b09",
    card: "#151915",
    foreground: "#f4f6f0",
    muted: "#232923",
    subtle: "#a1aaa0",
    border: "#364036",
    primary: "#cbff3d",
    onPrimary: "#18200a",
  },
  ocean: {
    background: "#081927",
    card: "#102b40",
    foreground: "#e8f7ff",
    muted: "#1b3c55",
    subtle: "#9dbfd4",
    border: "#31566f",
    primary: "#67d9f5",
    onPrimary: "#062331",
  },
  forest: {
    background: "#0b1b15",
    card: "#153025",
    foreground: "#ecfff3",
    muted: "#214333",
    subtle: "#a2c9b2",
    border: "#39644c",
    primary: "#86efac",
    onPrimary: "#102e1b",
  },
  sunset: {
    background: "#241319",
    card: "#3a2028",
    foreground: "#fff1e9",
    muted: "#512f36",
    subtle: "#d6adb0",
    border: "#70414b",
    primary: "#fdba74",
    onPrimary: "#432010",
  },
  rose: {
    background: "#fff5f8",
    card: "#ffffff",
    foreground: "#4b1836",
    muted: "#fce4ef",
    subtle: "#93546f",
    border: "#e9b8ce",
    primary: "#be185d",
    onPrimary: "#ffffff",
  },
} satisfies Record<ThemeName, Record<string, string>>;
export const popularCurrencies = [
  "INR",
  "USD",
  "GBP",
  "JPY",
  "EUR",
  "CAD",
  "AUD",
  "CNY",
  "CHF",
  "AED",
  "SGD",
  "NZD",
  "KRW",
  "BRL",
  "ZAR",
];
export const currencies = [
  ...new Set([
    ...popularCurrencies,
    ...(typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("currency")
      : []),
  ]),
];
export function currencyLabel(code: string) {
  const symbol =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? code;
  return `${symbol} · ${code}`;
}
export function formatCurrency(value: number | string, currency: string) {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(Number(value));
}
export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
export function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}
export function formatLabel(value: string) {
  return value
    .replace("invesment", "investment")
    .replace("bonues", "bonus")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
export type DailyTotal = { date: string; income: string; expense: string };
