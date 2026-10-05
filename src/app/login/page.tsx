import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const notice = error === "no-access" ? "Your account isn't set up in this workspace. Ask an admin to add you." : "";
  return <LoginForm notice={notice} />;
}
