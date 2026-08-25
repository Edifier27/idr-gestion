import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell nombre={session.user.name ?? session.user.username} rol={session.user.rol}>
      {children}
    </AppShell>
  );
}
