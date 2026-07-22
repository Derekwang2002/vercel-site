import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "katex/dist/katex.min.css";
import "./globals.css";

const SITE_NAME = "Derek Hub";
const DEFAULT_DESCRIPTION =
  "Personal technical hub for writing, resources, skills, and visual demos.";
const DEFAULT_OG_IMAGE = "/og-default.svg";

const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
})();

const THEME_INIT_SCRIPT = `
(() => {
  try {
    const stored = window.localStorage.getItem("theme");
    const theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

const LANGUAGE_INIT_SCRIPT = `
(() => {
  document.documentElement.lang =
    location.pathname === "/zh" || location.pathname.startsWith("/zh/")
      ? "zh-CN"
      : "en";
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: "website",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    url: SITE_URL,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} Open Graph Image`
      }
    ]
  }
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LANGUAGE_INIT_SCRIPT }} />
      </head>
      <body>
        <div className="site-shell">
          <SiteHeader />

          <div className="site-content">{children}</div>

          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
