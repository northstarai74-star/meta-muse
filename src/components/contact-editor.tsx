"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ContactForm } from "./contacts-view";

export function ContactEditor({ contact }: { contact: { id: string; name: string; email: string | null; phone: string | null; instagramHandle: string | null; company: string | null; notes: string | null; website: string | null; industry: string | null; country: string | null; doNotContact: boolean; lawfulBasis: string | null } }) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(false);
  return (
    <>
      <ContactForm
        id={contact.id}
        initial={contact}
        onCancel={() => router.refresh()}
        onDone={() => { setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 2000); }}
      />
      {saved && <p role="status" className="mt-2 text-xs font-medium text-emerald-600">Saved</p>}
    </>
  );
}
