import { redirect } from "next/navigation";

export default function LegacyProjectRedirectPage() {
  redirect("/projects/research-lab");
}
