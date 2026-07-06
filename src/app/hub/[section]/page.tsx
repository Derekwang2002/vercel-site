import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubNav } from "@/components/hub-nav";
import { ResourceList } from "@/components/resource-list";
import {
  RESOURCE_SECTIONS,
  getResourceSection,
  getResourcesBySection,
  type ResourceSection
} from "../../../../lib/resources";
import styles from "../page.module.css";

type HubSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export function generateStaticParams() {
  return RESOURCE_SECTIONS.map((section) => ({
    section: section.slug
  }));
}

export async function generateMetadata({
  params
}: HubSectionPageProps): Promise<Metadata> {
  const { section: rawSection } = await params;
  const section = getResourceSection(rawSection);

  if (!section) {
    return {
      title: "Hub Section"
    };
  }

  return {
    title: section.label,
    description: section.description,
    openGraph: {
      title: `${section.label} | Personal Website`,
      description: section.description,
      url: `/hub/${section.slug}`,
      images: [
        {
          url: "/og-default.svg",
          width: 1200,
          height: 630,
          alt: `${section.label} Open Graph Image`
        }
      ]
    }
  };
}

export default async function HubSectionPage({ params }: HubSectionPageProps) {
  const { section: rawSection } = await params;
  const section = getResourceSection(rawSection);

  if (!section) {
    notFound();
  }

  const resources = getResourcesBySection(section.slug);

  return (
    <main className={styles.hubPage}>
      <header className={styles.hero}>
        <h1 className={styles.title}>{section.label}</h1>
        <p className={styles.description}>{section.description}</p>
      </header>

      <HubNav active={section.slug as ResourceSection} />

      <ResourceList
        emptyMessage={`No ${section.label.toLowerCase()} resources yet.`}
        resources={resources}
        title={section.label}
      />
    </main>
  );
}
