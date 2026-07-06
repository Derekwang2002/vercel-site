import type { Metadata } from "next";
import { HubNav } from "@/components/hub-nav";
import { ResourceList } from "@/components/resource-list";
import { getFeaturedResources, getPublicResources } from "../../../lib/resources";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Hub",
  description: "Unified entry point for notes, skills, and demos.",
  openGraph: {
    title: "Hub | Personal Website",
    description: "Unified entry point for notes, skills, and demos.",
    url: "/hub",
    images: [
      {
        url: "/og-default.svg",
        width: 1200,
        height: 630,
        alt: "Hub Open Graph Image"
      }
    ]
  }
};

export default function HubPage() {
  const resources = getPublicResources();
  const featuredResources = getFeaturedResources();

  return (
    <main className={styles.hubPage}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Hub</h1>
        <p className={styles.description}>
          One entry point for long-term notes, reusable skills, and temporary demos.
        </p>
      </header>

      <HubNav active="all" />

      {featuredResources.length > 0 ? (
        <ResourceList
          emptyMessage="No featured resources yet."
          resources={featuredResources}
          searchable={false}
          title="Featured"
        />
      ) : null}

      <ResourceList
        emptyMessage="No public resources yet."
        resources={resources}
        title="All Resources"
      />
    </main>
  );
}
