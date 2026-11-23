import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { asegurarTablasWhatsapp } from "@/lib/db/asegurar-whatsapp";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { modoPrueba } from "@/lib/whatsapp/meta";
import { etiquetaCategoriaEvidencia, ramoDeTipo, seccionesExpediente } from "@/lib/categorias-evidencia";
import { etiquetaEtapaContacto } from "@/lib/etapa-contacto";
import { rubroDeTipo } from "@/lib/tipos-siniestro";
import { leerResumenes } from "@/lib/resumen-caso";
import { BandejaWhatsapp, type Conversacion, type Mensaje, type CasoOpcion, type OperadorTel, type CasoHerramientas } from "@/components/bandeja-whatsapp";
import "./whatsapp.css";

export const metadata: Metadata = { title: "WhatsApp · CRMgestion" };
export const dynamic = "force-dynamic";

const NINGUNO = "00000000-0000-0000-0000-000000000000";

// Bandeja de WhatsApp (solo admin), con la misma experiencia que WhatsApp
// Web / AsesorCRM: chats por operador a la izquierda, la conversación en el
// centro y, a la derecha, las herramientas para ubicar cada prueba en su caso.
export default async function WhatsappPage({ searchParams }: { searchParams: { c?: string; vista?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.rol !== "admin") redirect("/panel");
  if (!dbConfigurada()) return <main className="p-8 text-slate">Falta la base de datos.</main>;
  await asegurarTablasWhatsapp();
  await asegurarTablaEvidencia();
  const db = getDb();

  const convs = (await db.execute(sql`
    SELECT c.id, c.telefono, c.nombre, c.operador, c.ultimo_en, c.ultimo_texto, c.no_leidos, c.ventana_hasta,
           u.nombre AS nombre_operador, u.zona AS zona_operador,
           (SELECT count(*)::int FROM wa_mensaje m WHERE m.conversacion_id = c.id AND m.asignacion IN ('sin_asignar', 'pregunta')) AS pendientes,
           (SELECT m.direccion FROM wa_mensaje m WHERE m.conversacion_id = c.id ORDER BY m.creado_en DESC LIMIT 1) AS ultima_direccion,
           (SELECT m.estado FROM wa_mensaje m WHERE m.conversacion_id = c.id ORDER BY m.creado_en DESC LIMIT 1) AS ultimo_estado
    FROM wa_conversacion c LEFT JOIN usuarios u ON u.operador = c.operador AND u.rol = 'vendedor'
    ORDER BY c.ultimo_en DESC`)).rows as Conversacion[];

  const vistaSin = searchParams.vista === "sin";
  const seleccionada = vistaSin ? null : convs.find(c => c.id === searchParams.c) ?? null;
  const mensajes = (await db.execute(vistaSin
    ? sql`SELECT m.*, s.nro_siniestro AS caso_nro, COALESCE(s.asegurado, s.denunciante) AS caso_nombre, s.tipo AS caso_tipo, c.operador AS conv_operador
          FROM wa_mensaje m JOIN wa_conversacion c ON c.id = m.conversacion_id LEFT JOIN siniestros s ON s.id = m.siniestro_id
          WHERE m.asignacion IN ('sin_asignar', 'pregunta') ORDER BY m.creado_en DESC LIMIT 200`
    : sql`SELECT m.*, s.nro_siniestro AS caso_nro, COALESCE(s.asegurado, s.denunciante) AS caso_nombre, s.tipo AS caso_tipo, NULL AS conv_operador
          FROM wa_mensaje m LEFT JOIN siniestros s ON s.id = m.siniestro_id
          WHERE m.conversacion_id = ${seleccionada?.id ?? NINGUNO}
          ORDER BY m.creado_en ASC LIMIT 400`)).rows as Mensaje[];

  const casos = (await db.execute(sql`
    SELECT id, nro_siniestro AS nro, COALESCE(asegurado, denunciante) AS asegurado, operador, tipo
    FROM siniestros WHERE estado <> 'cerrado' ORDER BY creado_en DESC`)).rows as CasoOpcion[];
  const operadores = (await db.execute(sql`
    SELECT operador, nombre, telefono FROM usuarios WHERE rol = 'vendedor' AND activo = true AND operador IS NOT NULL ORDER BY nombre`)).rows as OperadorTel[];

  // Panel de herramientas: los casos abiertos del operador de este chat, con
  // las pruebas que pide su ramo, las que ya están y las que mandó por acá.
  let herramientas: CasoHerramientas[] = [];
  if (seleccionada?.operador) {
    const propios = (await db.execute(sql`
      SELECT id, nro_siniestro AS nro, COALESCE(asegurado, denunciante) AS asegurado, dni, tipo, domicilio,
             lugar_siniestro->>'calle1' AS lugar, etapa_contacto AS etapa, fecha_entrevista, tel_contacto AS telefono, creado_en
      FROM siniestros WHERE operador = ${seleccionada.operador} AND estado <> 'cerrado' ORDER BY creado_en DESC`)).rows as {
        id: string; nro: string | null; asegurado: string | null; dni: string | null; tipo: string | null; domicilio: string | null;
        lugar: string | null; etapa: string | null; fecha_entrevista: string | null; telefono: string | null; creado_en: string;
      }[];
    const ids = propios.map(p => p.id);
    const cats = ids.length ? (await db.execute(sql`SELECT siniestro_id, categoria FROM evidencia WHERE siniestro_id = ANY(${ids}::uuid[])`)).rows as { siniestro_id: string; categoria: string | null }[] : [];
    const porWa = ids.length ? (await db.execute(sql`SELECT siniestro_id, count(*)::int AS n FROM wa_mensaje WHERE conversacion_id = ${seleccionada.id} AND siniestro_id = ANY(${ids}::uuid[]) GROUP BY siniestro_id`)).rows as { siniestro_id: string; n: number }[] : [];
    const resumenes = await leerResumenes(ids);
    const ultimoWa = ids.length ? (await db.execute(sql`SELECT siniestro_id, max(creado_en) AS ultimo FROM wa_mensaje WHERE siniestro_id = ANY(${ids}::uuid[]) GROUP BY siniestro_id`)).rows as { siniestro_id: string; ultimo: string }[] : [];
    herramientas = propios.map(p => {
      const ramo = ramoDeTipo(p.tipo);
      const pedidas = seccionesExpediente(ramo).filter(x => x.id !== "otros" && x.id !== "lugar").flatMap(x => x.categorias);
      const tiene = new Set(cats.filter(c => c.siniestro_id === p.id && c.categoria).map(c => c.categoria as string));
      const faltan = pedidas.filter(c => !tiene.has(c));
      return {
        id: p.id, nro: p.nro, asegurado: p.asegurado, dni: p.dni, tipo: p.tipo, rubro: rubroDeTipo(p.tipo), domicilio: p.domicilio, lugar: p.lugar,
        ingreso: new Date(p.creado_en).toISOString(),
        telefono: p.telefono, etapa: etiquetaEtapaContacto(p.etapa), entrevista: p.fecha_entrevista ? new Date(p.fecha_entrevista).toISOString() : null,
        pedidas: pedidas.length, tiene: pedidas.length - faltan.length, faltan: faltan.map(c => etiquetaCategoriaEvidencia(c, ramo)),
        porWhatsapp: porWa.find(x => x.siniestro_id === p.id)?.n ?? 0,
        resumen: resumenes.get(p.id)?.datos ?? null,
        resumenEn: resumenes.get(p.id)?.generado_en ? new Date(resumenes.get(p.id)!.generado_en).toISOString() : null,
        // Desactualizado: llegaron pruebas o mensajes después del resumen.
        resumenViejo: (() => {
          const r = resumenes.get(p.id);
          if (!r) return false;
          const evNow = cats.filter(c => c.siniestro_id === p.id).length;
          const ult = ultimoWa.find(x => x.siniestro_id === p.id)?.ultimo;
          return evNow !== r.evidencias || (!!ult && new Date(ult) > new Date(r.generado_en));
        })(),
      };
    });
  }

  return (
    <main className="wa-pagina">
      <BandejaWhatsapp
        conversaciones={convs}
        seleccionadaId={seleccionada?.id ?? null}
        vistaSin={vistaSin}
        mensajes={mensajes}
        casos={casos}
        operadores={operadores}
        herramientas={herramientas}
        modoPrueba={modoPrueba()}
        miNombre={session.user.name ?? "Admin"}
      />
    </main>
  );
}
