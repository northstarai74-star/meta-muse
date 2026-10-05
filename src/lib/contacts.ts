import { z } from "zod";
import { LAWFUL_BASIS } from "./constants";

export const ContactBody = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  instagramHandle: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  doNotContact: z.boolean().optional(),
  lawfulBasis: z.enum(Object.keys(LAWFUL_BASIS) as [string, ...string[]]).optional().or(z.literal("")),
});

export const cleanContact = (b: z.infer<typeof ContactBody>) => ({
  name: b.name,
  email: b.email || null,
  phone: b.phone || null,
  instagramHandle: b.instagramHandle?.replace(/^@/, "") || null,
  company: b.company || null,
  website: b.website || null,
  industry: b.industry || null,
  country: b.country || null,
  notes: b.notes || null,
  // Only touch these when sent, so editing other fields never clears an opt-out.
  ...(b.doNotContact !== undefined ? { doNotContact: b.doNotContact } : {}),
  ...(b.lawfulBasis !== undefined ? { lawfulBasis: b.lawfulBasis || null } : {}),
});
