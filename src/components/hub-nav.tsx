import Link from "next/link";
import { RESOURCE_SECTIONS, type ResourceSection } from "../../lib/resources";
import styles from "./hub-nav.module.css";

type HubNavProps = {
  active: "all" | ResourceSection;
};

export function HubNav({ active }: HubNavProps) {
  const items = [
    { slug: "all", label: "All", href: "/hub" },
    ...RESOURCE_SECTIONS.map((section) => ({
      slug: section.slug,
      label: section.label,
      href: `/hub/${section.slug}`
    }))
  ];

  return (
    <nav aria-label="Hub sections" className={styles.nav}>
      {items.map((item) => (
        <Link
          aria-current={active === item.slug ? "page" : undefined}
          className={active === item.slug ? `${styles.link} ${styles.active}` : styles.link}
          href={item.href}
          key={item.slug}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
