import { ArrowRight, Mail, PhoneCall, Table2, Workflow } from "lucide-react";
import { Card, CardHeader } from "./ui";

const STEPS = [
  { icon: Table2, title: "Airtable: new record", body: "A new customer enquiry is added to the Airtable table (name, email, phone, clinic, location)." },
  { icon: Workflow, title: "Make.com router", body: "The scenario picks up the new record and routes it to the follow-up actions." },
  { icon: PhoneCall, title: "Vapi: outbound call", body: "The AI voice assistant calls the customer on their phone number." },
  { icon: Mail, title: "Gmail: follow-up email", body: "A follow-up email is sent to the customer's email address." },
];

export function CustomerServiceView() {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader title="Airtable → Vapi + Gmail" subtitle="Make.com scenario: Integration Airtable, Vapi, Gmail" />
        <ol className="grid gap-3 p-5 pt-0 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch">
          {STEPS.map((s, i) => (
            <li key={s.title} className="contents">
              <div className="rounded-xl border p-4">
                <s.icon size={18} className="mb-2 text-muted" />
                <p className="font-medium">{s.title}</p>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </div>
              {i < STEPS.length - 1 && <ArrowRight size={18} className="mx-auto self-center text-muted rotate-90 md:rotate-0" />}
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <CardHeader title="Setup notes" subtitle="Connections are set in Make.com, not in this app." />
        <ul className="list-disc space-y-1 p-5 pt-0 pl-10 text-sm text-muted">
          <li>Airtable, Vapi and Gmail are linked by connection ID. Re-link them when importing the blueprint into a new Make account.</li>
          <li>Import the blueprint in Make: Scenarios → Import blueprint (file: <code>automations/make/airtable-vapi-gmail.blueprint.json</code>).</li>
          <li>The Gmail route for the second branch sends to a fixed address; change it in Make if needed.</li>
        </ul>
      </Card>
    </div>
  );
}
