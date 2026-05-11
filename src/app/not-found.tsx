import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>The page you are looking for is not here.</p>
      <p>
        <Link href="/">Go to Home</Link>
      </p>
      <p>
        <Link href="/blog">Browse Blog</Link>
      </p>
    </main>
  );
}
