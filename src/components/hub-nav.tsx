import Link from "next/link";
import { RESOURCE_SECTIONS, type ResourceSection } from "../../lib/resources";
import { RefreshOnPageRestore } from "./refresh-on-page-restore";
import styles from "./hub-nav.module.css";

type HubNavProps = {
  active: ResourceSection;
  locale?: "en" | "zh";
};

type NavItem = {
  slug: ResourceSection;
  label: string;
  href: string;
};

export function HubNav({ active, locale = "en" }: HubNavProps) {
  const items: NavItem[] = RESOURCE_SECTIONS.map((section) => ({
    slug: section.slug,
    label: locale === "zh" ? ({ all: "全部", skills: "Skills", demos: "演示" } as const)[section.slug] : section.label,
    href: `${locale === "zh" ? "/zh" : ""}/hub/${section.slug}`
  }));

  return (
    <>
      <RefreshOnPageRestore />
      <nav aria-label={locale === "zh" ? "Hub 分类" : "Hub sections"} className={styles.nav}>
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
    </>
  );
}
