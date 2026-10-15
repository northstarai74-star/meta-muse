import { PageHeader } from "@/components/shell";
import { AssistantView } from "@/components/assistant-view";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Chat with Claude about your leads, conversations and finances" />
      <AssistantView />
    </>
  );
}
