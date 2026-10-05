import { z } from "zod";

export const ContactBody = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  instagramHandle: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

export const cleanContact = (b: z.infer<typeof ContactBody>) => ({
  name: b.name,
  email: b.email || null,
  phone: b.phone || null,
  instagramHandle: b.instagramHandle?.replace(/^@/, "") || null,
  company: b.company || null,
  notes: b.notes || null,
});
