import { redirect } from "next/navigation";

export default function LegacyDemoRedirectPage() {
  redirect("/research/demo");
}
