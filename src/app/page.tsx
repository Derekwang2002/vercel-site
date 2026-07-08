import type { Metadata } from "next";
import Link from "next/link";
import {
  getFeaturedResources,
  getResourceSourceLabel,
  getResourceTypeLabel,
  isExternalResourceHref
} from "../../lib/resources";
import type { Resource } from "../../content/resources";
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
  { label: "Email", href: "mailto:derekwang0282@gmail.com" }
];

export default function HomePage() {
  const pinnedResources = getFeaturedResources();

  return (
    <main className={styles.home}>
      <section className={styles.profile} aria-labelledby="home-title">
        <div className={styles.avatar} aria-hidden="true" />
        <h1 className={styles.name} id="home-title">
          Derek Wang
        </h1>
        <p className={styles.tagline}>USC CS37 / Programmer</p>
        <ul className={styles.socialList}>
          {SOCIAL_LINKS.map((link) => (
            <li key={link.label}>
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {pinnedResources.length > 0 ? (
        <section className={styles.pinnedSection} aria-labelledby="pinned-title">
          <div className={styles.pinnedHeader}>
            <h2 id="pinned-title">Pinned</h2>
            <Link href="/hub/all">View all</Link>
          </div>

          <ul className={styles.pinnedGrid}>
            {pinnedResources.map((resource) => (
              <li className={styles.pinnedCard} key={`${resource.type}-${resource.href}`}>
                <PinnedResourceLink resource={resource} />
                <p className={styles.pinnedDescription}>{resource.description}</p>
                <p className={styles.pinnedMeta}>{getPinnedMeta(resource)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function PinnedResourceLink({ resource }: { resource: Resource }) {
  if (isExternalResourceHref(resource.href)) {
    return (
      <a className={styles.pinnedLink} href={resource.href} rel="noreferrer" target="_blank">
        {resource.title}
      </a>
    );
  }

  return (
    <Link className={styles.pinnedLink} href={resource.href}>
      {resource.title}
    </Link>
  );
}

function getPinnedMeta(resource: Resource): string {
  return [
    getResourceTypeLabel(resource.type),
    getResourceSourceLabel(resource.source),
    ...resource.tags
  ].join(" · ");
}
