import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import * as XLSX from "xlsx";
import { getDb, dbConfigurada } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { sesionRequerida } from "@/lib/acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/export — genera el Excel con las mismas 22 columnas del original,
// para que el cliente lo baje cuando quiera. El CRM es la fuente de verdad;
// el Excel es una exportación, no un segundo sistema en paralelo.
export async function GET() {
  const session = await sesionRequerida();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!dbConfigurada()) {
    return NextResponse.json({ error: "DATABASE_URL no configurada." }, { status: 501 });
  }
  const db = getDb();
  const todas = await db.select().from(siniestros).orderBy(desc(siniestros.creadoEn));
  const rows = session.user.rol === "admin" ? todas : todas.filter(s => s.operador === session.user.operador);

  const data = rows.map((s, i) => {
    const lugar = (s.lugarSiniestro ?? {}) as Record<string, string>;
    const lugarTxt = [lugar.calle1, lugar.altura1, lugar.localidad, lugar.provincia]
      .filter(Boolean)
      .join(" ");
    return {
      ORDEN: i + 1,
      "NRO SINIESTRO": s.nroSiniestro,
      "NRO GESTION": s.numeroGestion,
      "FECHA DE INGRESO": s.fechaIngreso,
      ASEGURADO: s.asegurado,
      DENUNCIANTE: s.denunciante,
      DNI: s.dni,
      "TEL CONTACTO": s.telContacto,
      "CEL CONTACTO": s.celContacto,
      TEL: s.tel,
      ESTADO: s.estado,
      "COMPAÑÍA": s.compania,
      TIPO: s.tipo,
      Resultado: s.resultado,
      DOMICILIO: s.domicilio,
      "FECHA DE OCURRENCIA": s.fechaOcurrencia,
      "LUGAR DEL SINIESTRO": lugarTxt,
      "KM TOTAL": s.kmTotal,
      FACTURAR: s.facturar,
      "NUMERO FC": s.numeroFc,
      "GASTO FIJO": s.gastoFijo,
      OPERADOR: s.operador,
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Siniestros");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="siniestros-atm.xlsx"',
    },
  });
}
