import type { Metadata } from "next";
import {
  getPostSeriesDocumentMetadata,
  PostSeriesDocumentPage
} from "@/components/post-series-document-page";
import { getAllPostSeriesDocuments } from "../../../../../lib/post-series";

type Props = {
  params: Promise<{ doc: string; slug: string }>;
};

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ doc: string; slug: string }>> {
  return (await getAllPostSeriesDocuments("en")).map((document) => ({
    doc: document.slug,
    slug: document.seriesSlug
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { doc, slug } = await params;
  return getPostSeriesDocumentMetadata({ docSlug: doc, locale: "en", seriesSlug: slug });
}

export default async function EnglishPostSeriesDocumentRoute({ params }: Props) {
  const { doc, slug } = await params;
  return <PostSeriesDocumentPage docSlug={doc} locale="en" seriesSlug={slug} />;
}
