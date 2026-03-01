import styles from "./page.module.css";

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
