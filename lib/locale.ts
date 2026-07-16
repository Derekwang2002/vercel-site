export const SUPPORTED_LOCALES = ["en", "zh"] as const;

export type ContentLocale = (typeof SUPPORTED_LOCALES)[number];

export function isContentLocale(value: string): value is ContentLocale {
  return SUPPORTED_LOCALES.includes(value as ContentLocale);
}

export function localePath(locale: ContentLocale, pathname: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return locale === "zh" ? (normalized === "/" ? "/zh" : `/zh${normalized}`) : normalized;
}

export function formatContentDate(date: string, locale: ContentLocale): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}
