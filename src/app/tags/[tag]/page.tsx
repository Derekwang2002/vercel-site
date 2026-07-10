import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAllTagsWithCounts } from "../../../../lib/posts";

type TagPageProps = {
  params: Promise<{
    tag: string;
  }>;
};

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ tag: string }>> {
  const tags = await getAllTagsWithCounts();
  return tags.map((item) => ({ tag: item.slug }));
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const tags = await getAllTagsWithCounts();
  const matchedTag = tags.find((item) => item.slug === tag);
  const label = matchedTag?.tag ?? "Tag";

  return {
    title: `${label} | Blog`,
    description: `Blog posts tagged with ${label}.`,
    openGraph: {
      title: `${label} | Blog | Derek Hub`,
      description: `Blog posts tagged with ${label}.`,
      url: `/blog?tag=${tag}`,
      images: [
        {
          url: "/og-default.svg",
          width: 1200,
          height: 630,
          alt: `${label} Open Graph Image`
        }
      ]
    }
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params;
  redirect(`/blog?tag=${encodeURIComponent(tag)}`);
}
