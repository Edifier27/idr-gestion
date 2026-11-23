import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Pantalla de entrada después del login: el admin arranca en los mensajes de
// WhatsApp (CRMgestion); el operador, en su tablero.
export default async function Inicio() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(session.user.rol === "admin" ? "/whatsapp" : "/panel");
}
