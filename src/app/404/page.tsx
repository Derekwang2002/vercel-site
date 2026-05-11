import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404",
  description: "The requested page could not be found.",
  openGraph: {
    title: "404 | Personal Website",
    description: "The requested page could not be found.",
    url: "/404",
    images: [
      {
        url: "/og-default.svg",
        width: 1200,
        height: 630,
        alt: "Not Found Open Graph Image"
      }
    ]
  }
};

export default function FourOhFourRoutePage() {
  return (
    <main>
      <h1>404</h1>
      <p>This is the explicit /404 route placeholder.</p>
    </main>
  );
}
