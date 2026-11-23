import { getDb } from "@/lib/db";
import { siniestros, datoExtra } from "@/lib/db/schema";
import { asegurarTablaDatoExtra } from "@/lib/db/asegurar-dato-extra";
import { calcularFacturacion } from "@/lib/facturacion";
import type { CaratulaExtraida } from "@/lib/types";
import { normalizarTipo } from "@/lib/tipos-siniestro";

// Alta de un siniestro a partir de los datos ya extraídos (de un PDF de
// carátula o de un mail). Compartido entre el alta manual y la importación
// automática desde la bandeja de Gmail. gmailMensajeId (si vino de un mail)
// queda guardado para poder detectar duplicados y marcar en la bandeja qué
// mails ya se cargaron como caso.
export async function crearSiniestro(datos: CaratulaExtraida, operador: string | null, gmailMensajeId?: string) {
  const kmTotal: number | null = null; // se carga después, con la calculadora de km del caso
  const db = getDb();
  const [row] = await db
    .insert(siniestros)
    .values({
      nroSiniestro: datos.nro_siniestro ?? null,
      numeroGestion: datos.numero_gestion ?? null,
      compania: datos.compania ?? null,
      rama: datos.rama ?? null,
      tipo: normalizarTipo(datos.tipo),
      poliza: datos.poliza ?? null,
      asegurado: datos.asegurado ?? null,
      denunciante: datos.denunciante ?? null,
      dni: datos.dni ?? null,
      emailContacto: datos.email_contacto ?? null,
      telContacto: datos.tel_contacto ?? null,
      celContacto: datos.cel_contacto ?? null,
      tel: datos.tel ?? null,
      domicilio: datos.domicilio ?? null,
      estadoOrigen: datos.estado_origen ?? null,
      fechaIngreso: datos.fecha_ingreso ?? null,
      fechaOcurrencia: datos.fecha_ocurrencia ?? null,
      horaOcurrencia: datos.hora_ocurrencia ?? null,
      fechaDenuncia: datos.fecha_denuncia ?? null,
      // El "Relato de la denuncia" es la ampliación del asegurado + la
      // denuncia policial (lo arma la IA al leerlas, lib/leer-denuncia.ts);
      // lo que dice la carátula queda como dato adicional, abajo.
      relatoDenuncia: null,
      lugarSiniestro: datos.lugar_siniestro ?? null,
      operador,
      kmTotal,
      facturar: calcularFacturacion(kmTotal),
      gmailMensajeId: gmailMensajeId ?? null,
    })
    .returning();
  if (datos.relato_denuncia?.trim()) {
    try {
      await asegurarTablaDatoExtra();
      await db.insert(datoExtra).values({ siniestroId: row.id, etiqueta: "Observaciones de la aseguradora", valor: datos.relato_denuncia.trim() });
    } catch {
      // no bloquea el alta del caso
    }
  }
  return row;
}
