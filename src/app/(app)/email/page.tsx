import { getCurrentUser } from "@/lib/session";
import { getSender } from "@/lib/providers";
import { PageHeader } from "@/components/shell";
import { EmailView } from "@/components/email-view";

export const dynamic = "force-dynamic";

export default async function EmailPage() {
  const [me, sender] = await Promise.all([getCurrentUser(), getSender()]);
  return (
    <>
      <PageHeader title="Email" subtitle="Send email and keep your contacts in Brevo" />
      <EmailView sender={sender ?? { email: "", name: "" }} isAdmin={me?.role === "ADMIN"} />
    </>
  );
}
