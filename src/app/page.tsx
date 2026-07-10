import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  getFeaturedResources,
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
    title: "Home | Derek Hub",
    description:
      "Home page for Derek with profile, tagline, and social links to explore writing and tags.",
    url: "/",
    images: [
      {
        url: "/og-default.svg",
        width: 1200,
        height: 630,
        alt: "Derek Hub Open Graph Image"
      }
    ]
  }
};

const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com", icon: "github" },
  { label: "LinkedIn", href: "https://www.linkedin.com", icon: "linkedin" },
  { label: "Email", href: "mailto:derekwang0282@gmail.com", icon: "email" }
] as const;

export default async function HomePage() {
  const pinnedResources = (await getFeaturedResources()).slice(0, 3);

  return (
    <main className={styles.home}>
      <section className={styles.profile} aria-labelledby="home-title">
        <Image
          alt="Derek Wang"
          className={styles.avatar}
          height={112}
          priority
          sizes="112px"
          src="/avatar.png"
          width={112}
        />
        <h1 className={styles.name} id="home-title">
          Derek Wang
        </h1>
        <p className={styles.tagline}>USC CS37 / Programmer</p>
        <ul className={styles.socialList}>
          {SOCIAL_LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                rel={link.href.startsWith("mailto:") ? undefined : "noreferrer"}
                target={link.href.startsWith("mailto:") ? undefined : "_blank"}
              >
                <SocialIcon icon={link.icon} />
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {pinnedResources.length > 0 ? (
        <section className={styles.pinnedSection} id="pinned" aria-labelledby="pinned-title">
          <div className={styles.pinnedHeader}>
            <h2 id="pinned-title">Pinned</h2>
            <Link href="/hub/all">View all</Link>
          </div>

          <ul className={styles.pinnedList}>
            {pinnedResources.map((resource) => (
              <li className={styles.pinnedItem} key={`${resource.type}-${resource.href}`}>
                <div className={styles.pinnedItemHeader}>
                  <PinnedResourceLink resource={resource} />
                  <span className={styles.pinnedMeta}>{getPinnedMeta(resource)}</span>
                </div>
                <p className={styles.pinnedDescription}>{resource.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function SocialIcon({ icon }: { icon: (typeof SOCIAL_LINKS)[number]["icon"] }) {
  if (icon === "email") {
    return (
      <span aria-hidden="true" className={styles.socialGlyph}>
        @
      </span>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={styles.socialIcon}
      focusable="false"
      viewBox="0 0 16 16"
    >
      <path d={icon === "github" ? GITHUB_MARK_PATH : LINKEDIN_MARK_PATH} />
    </svg>
  );
}

const GITHUB_MARK_PATH =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A6.93 6.93 0 0 1 8 3.36c.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z";

const LINKEDIN_MARK_PATH =
  "M0 1.15C0 .51.53 0 1.18 0h13.64C15.47 0 16 .51 16 1.15v13.7c0 .64-.53 1.15-1.18 1.15H1.18C.53 16 0 15.49 0 14.85V1.15zm4.94 12.24V6.17h-2.4v7.22h2.4zM3.74 5.18c.84 0 1.36-.55 1.36-1.25-.02-.7-.52-1.24-1.34-1.24-.82 0-1.36.54-1.36 1.24 0 .7.52 1.25 1.33 1.25h.01zm4.91 8.21V9.36c0-.22.02-.43.08-.59.17-.43.57-.87 1.23-.87.87 0 1.22.66 1.22 1.63v3.86h2.4V9.25c0-2.22-1.18-3.25-2.76-3.25-1.27 0-1.85.7-2.17 1.19v.03h-.02l.02-.03V6.17h-2.4c.03.68 0 7.22 0 7.22h2.4z";

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
  return getResourceTypeLabel(resource.type);
}
