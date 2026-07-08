import { redirect } from "next/navigation";

export default function FeaturedRedirectPage() {
  redirect("/#pinned");
}
