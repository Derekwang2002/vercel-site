import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubNav } from "@/components/hub-nav";
import { ResourceList } from "@/components/resource-list";
import {
  RESOURCE_SECTIONS,
  getResourceSection
} from "../../../../lib/resources";
import styles from "../page.module.css";
import { getLocalizedResourcesBySection } from "../../../../lib/localized-resources";

type HubSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export const dynamicParams = false;

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
    alternates: {
      canonical: `/hub/${section.slug}`,
      languages: { en: `/hub/${section.slug}`, "zh-CN": `/zh/hub/${section.slug}` }
    },
    openGraph: {
      title: `${section.label} | Derek Hub`,
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

  const resources = await getLocalizedResourcesBySection(section.slug, "en");

  return (
    <main className={styles.hubPage}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Hub</h1>
      </header>

      <HubNav active={section.slug} />
      <p className={styles.sectionDescription}>{section.description}</p>

      <ResourceList
        emptyMessage={`No ${section.label.toLowerCase()} resources yet.`}
        resources={resources}
      />
    </main>
  );
}
