import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { asegurarTablasWhatsapp } from "@/lib/db/asegurar-whatsapp";
import { modoPrueba } from "@/lib/whatsapp/meta";
import { BandejaWhatsapp, type Conversacion, type Mensaje, type CasoOpcion, type OperadorTel } from "@/components/bandeja-whatsapp";

export const metadata: Metadata = { title: "WhatsApp · CRMgestion" };
export const dynamic = "force-dynamic";

// Bandeja de WhatsApp (solo admin): un chat por operador, las pruebas que
// mandó con el caso donde quedaron y lo que falta ubicar ("Sin asignar").
export default async function WhatsappPage({ searchParams }: { searchParams: { c?: string; vista?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");
  if (!dbConfigurada()) return <main className="p-8 text-slate">Falta la base de datos.</main>;
  await asegurarTablasWhatsapp();
  const db = getDb();

  const convs = (await db.execute(sql`
    SELECT c.id, c.telefono, c.nombre, c.operador, c.ultimo_en, c.ultimo_texto, c.no_leidos, c.ventana_hasta,
           u.nombre AS nombre_operador,
           (SELECT count(*)::int FROM wa_mensaje m WHERE m.conversacion_id = c.id AND m.asignacion IN ('sin_asignar', 'pregunta')) AS pendientes
    FROM wa_conversacion c LEFT JOIN usuarios u ON u.operador = c.operador AND u.rol = 'vendedor'
    ORDER BY c.ultimo_en DESC`)).rows as Conversacion[];

  const vistaSin = searchParams.vista === "sin";
  const seleccionada = vistaSin ? null : convs.find(c => c.id === searchParams.c) ?? convs[0] ?? null;
  const mensajes = (await db.execute(vistaSin
    ? sql`SELECT m.*, s.nro_siniestro AS caso_nro, COALESCE(s.asegurado, s.denunciante) AS caso_nombre, c.operador AS conv_operador
          FROM wa_mensaje m JOIN wa_conversacion c ON c.id = m.conversacion_id LEFT JOIN siniestros s ON s.id = m.siniestro_id
          WHERE m.asignacion IN ('sin_asignar', 'pregunta') ORDER BY m.creado_en DESC LIMIT 200`
    : sql`SELECT m.*, s.nro_siniestro AS caso_nro, COALESCE(s.asegurado, s.denunciante) AS caso_nombre, NULL AS conv_operador
          FROM wa_mensaje m LEFT JOIN siniestros s ON s.id = m.siniestro_id
          WHERE m.conversacion_id = ${seleccionada?.id ?? "00000000-0000-0000-0000-000000000000"}
          ORDER BY m.creado_en ASC LIMIT 300`)).rows as Mensaje[];

  const casos = (await db.execute(sql`
    SELECT id, nro_siniestro AS nro, COALESCE(asegurado, denunciante) AS asegurado, operador, tipo
    FROM siniestros WHERE estado <> 'cerrado' ORDER BY creado_en DESC`)).rows as CasoOpcion[];
  const operadores = (await db.execute(sql`
    SELECT operador, nombre, telefono FROM usuarios WHERE rol = 'vendedor' AND activo = true AND operador IS NOT NULL ORDER BY nombre`)).rows as OperadorTel[];

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber">CRMgestion</p>
          <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-ink">WhatsApp</h1>
          <p className="text-sm text-slate">Lo que mandan los operadores: la IA ubica cada prueba en su caso. Lo que no pudo ubicar queda en Sin asignar.</p>
        </div>
        {modoPrueba() && (
          <span className="rounded-full border border-amber/40 bg-amber/10 px-3 py-1 text-xs font-semibold text-amber">Modo prueba: número de WhatsApp sin conectar, no sale nada a Meta</span>
        )}
      </header>
      <BandejaWhatsapp
        conversaciones={convs}
        seleccionadaId={seleccionada?.id ?? null}
        vistaSin={vistaSin}
        mensajes={mensajes}
        casos={casos}
        operadores={operadores}
      />
    </main>
  );
}
