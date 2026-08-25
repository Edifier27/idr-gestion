import { eq, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros, bitacora, evidencia } from "@/lib/db/schema";
import { desgloseFacturacion, formatARS } from "@/lib/facturacion";
import { puedeVerCaso, puedeVerFacturacion } from "@/lib/acceso";
import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { EstadoBadge } from "@/components/estado-badge";
import { CobroBadge } from "@/components/cobro-badge";
import { EvidenciaPanel } from "@/components/evidencia-panel";
import { DescargoPanel } from "@/components/descargo-panel";
import { MailPanel } from "@/components/mail-panel";

export const dynamic = "force-dynamic";

export default async function Detalle({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!dbConfigurada()) return <p className="p-10 text-slate">Conectá la base de datos.</p>;
  const db = getDb();
  const [s] = await db.select().from(siniestros).where(eq(siniestros.id, params.id));
  if (!s) notFound();
  if (!puedeVerCaso(session, s.operador)) notFound();
  const verFacturacion = puedeVerFacturacion(session);
  const notas = await db.select().from(bitacora)
    .where(eq(bitacora.siniestroId, params.id))
    .orderBy(desc(bitacora.fecha));
  await asegurarTablaEvidencia();
  const archivos = await db.select().from(evidencia)
    .where(eq(evidencia.siniestroId, params.id))
    .orderBy(desc(evidencia.creadoEn));
  const lugar = (s.lugarSiniestro ?? {}) as Record<string,string>;
  const lugarTxt = [lugar.calle1, lugar.altura1, lugar.localidad, lugar.provincia].filter(Boolean).join(" ");
  const desg = desgloseFacturacion(s.kmTotal);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <a href="/panel" className="mb-4 inline-flex items-center gap-1 text-sm text-slate hover:text-ink">
        <span aria-hidden>←</span> Tablero
      </a>

      {/* Cabecera */}
      <div className="mb-6 flex items-start justify-between rounded-lg border border-line bg-white p-5 shadow-sm">
        <div>
          <p className="font-mono text-xs text-slate">Gestión {s.numeroGestion ?? "—"} · Siniestro {s.nroSiniestro ?? "—"}</p>
          <h1 className="mt-1 text-xl font-semibold text-ink">{s.asegurado ?? "Sin asegurado"}</h1>
          <p className="text-sm text-slate">{s.tipo ?? "—"} · {s.compania ?? "—"}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <EstadoBadge estado={s.estado} />
          {verFacturacion && <CobroBadge estado={s.estadoCobro} />}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Datos del siniestro */}
        <Bloque titulo="Datos del siniestro">
          <Dato k="DNI" v={s.dni} /><Dato k="Póliza" v={s.poliza} />
          <Dato k="Denunciante" v={s.denunciante} /><Dato k="Domicilio" v={s.domicilio} />
          <Dato k="Fecha ocurrencia" v={s.fechaOcurrencia} /><Dato k="Lugar del hecho" v={lugarTxt} />
          <Dato k="Contacto" v={s.telContacto ?? s.celContacto} /><Dato k="Email" v={s.emailContacto} />
          <Dato k="Vencimiento gestión" v={s.fechaLimite} /><Dato k="Operador" v={s.operador} />
        </Bloque>

        {/* Facturación + cobro (solo admin) */}
        <div className="space-y-4">
          {verFacturacion && (
            <Bloque titulo="Facturación">
              <Dato k="Km total" v={s.kmTotal != null ? `${s.kmTotal} km` : null} />
              <Dato k="Km bonificados" v={`${desg.kmBonificados} km`} />
              <Dato k="Km facturables" v={`${desg.kmFacturables} km × $650`} />
              <Dato k="Gasto km" v={formatARS(desg.montoKm)} />
              <Dato k="Informe" v={formatARS(desg.montoInforme)} />
              <div className="flex items-center justify-between border-t border-line pt-3 mt-2">
                <span className="text-sm font-semibold text-ink">Total</span>
                <span className="tnum text-lg font-bold text-amber">{formatARS(desg.total)}</span>
              </div>
            </Bloque>
          )}

          {/* Botones de acción */}
          <Bloque titulo="Acciones">
            <div className="grid grid-cols-2 gap-2">
              {verFacturacion && <BtnLink href={`/api/factura-pdf?id=${s.id}`} label="📄 Factura PDF" />}
              <BtnLink href={`/api/caratula-pdf?id=${s.id}`} label="📋 Carátula PDF" />
              <BtnLink href={`/api/expediente-pdf?id=${s.id}`} label="🗂️ Expediente PDF" />
            </div>
          </Bloque>

          {/* Nuevo mensaje */}
          <Bloque titulo="Enviar mail">
            <MailPanel
              siniestroId={s.id}
              destinatarioSugerido={s.emailContacto}
              archivos={archivos.map(a => ({ id: a.id, nombre: a.nombre, tipo: a.tipo }))}
            />
          </Bloque>
        </div>

        {/* Evidencia */}
        <div className="md:col-span-2">
          <Bloque titulo="Evidencia">
            <EvidenciaPanel siniestroId={s.id} archivosIniciales={archivos} />
          </Bloque>
        </div>

        {/* Descargo: relato de lo sucedido, a cargo del vendedor */}
        <div className="md:col-span-2">
          <Bloque titulo="Descargo">
            <DescargoPanel siniestroId={s.id} descargoInicial={s.descargo} />
          </Bloque>
        </div>

        {/* Informe técnico-legal */}
        {s.informe && (
          <div className="md:col-span-2">
            <Bloque titulo="Informe técnico-legal (borrador IA)">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-ink">{s.informe}</pre>
            </Bloque>
          </div>
        )}

        {/* Bitácora */}
        <div className="md:col-span-2">
          <Bloque titulo={`Bitácora (${notas.length} entradas)`}>
            {notas.length === 0
              ? <p className="text-sm text-slate">Sin entradas todavía.</p>
              : notas.map(n => (
                  <div key={n.id} className="border-b border-line pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-paper px-1.5 py-0.5 text-xs font-medium text-slate capitalize">{n.tipo}</span>
                      <span className="text-xs text-slate">{new Date(n.fecha).toLocaleString("es-AR")}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink">{n.nota}</p>
                  </div>
                ))
            }
          </Bloque>
        </div>
      </div>
    </main>
  );
}

function Bloque({ titulo, children }: { titulo:string; children:React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate">{titulo}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
function Dato({ k, v }: { k:string; v:string|null }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate">{k}</span>
      <span className="text-right text-ink">{v ?? "—"}</span>
    </div>
  );
}
function BtnLink({ href, label }: { href:string; label:string }) {
  return (
    <a href={href} className="block rounded border border-ink/20 px-3 py-2 text-center text-xs font-medium text-ink transition hover:bg-ink hover:text-paper">
      {label}
    </a>
  );
}
