import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Home page for Derek with profile, tagline, and social links to explore writing and tags.",
  openGraph: {
    title: "Home | Personal Website",
    description:
      "Home page for Derek with profile, tagline, and social links to explore writing and tags.",
    url: "/",
    images: [
      {
        url: "/og-default.svg",
        width: 1200,
        height: 630,
        alt: "Personal Website Open Graph Image"
      }
    ]
  }
};

const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com" },
  { label: "LinkedIn", href: "https://www.linkedin.com" },
  { label: "Email", href: "mailto:hello@example.com" }
];

export default function HomePage() {
  return (
    <main className={styles.home}>
      <div className={styles.avatar} aria-hidden="true" />
      <h1 className={styles.name}>Derek</h1>
      <p className={styles.tagline}>Professor / Entrepreneur / Artisan</p>
      <ul className={styles.socialList}>
        {SOCIAL_LINKS.map((link) => (
          <li key={link.label}>
            <a href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
