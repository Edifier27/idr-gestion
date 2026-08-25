import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-paper md:pl-56">
      <Sidebar nombre={session.user.name ?? session.user.username} rol={session.user.rol} />
      {children}
    </div>
  );
}
