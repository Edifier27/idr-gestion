import { getDb } from "@/lib/db";
import { siniestros } from "@/lib/db/schema";
import { calcularFacturacion } from "@/lib/facturacion";
import type { CaratulaExtraida } from "@/lib/types";

// Alta de un siniestro a partir de los datos ya extraídos (de un PDF de
// carátula o de un mail). Compartido entre el alta manual y la importación
// automática desde la bandeja de Gmail.
export async function crearSiniestro(datos: CaratulaExtraida, operador: string) {
  const kmTotal: number | null = null; // se carga después, con la calculadora de km del caso
  const db = getDb();
  const [row] = await db
    .insert(siniestros)
    .values({
      nroSiniestro: datos.nro_siniestro ?? null,
      numeroGestion: datos.numero_gestion ?? null,
      compania: datos.compania ?? null,
      rama: datos.rama ?? null,
      tipo: datos.tipo ?? null,
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
      lugarSiniestro: datos.lugar_siniestro ?? null,
      operador,
      kmTotal,
      facturar: calcularFacturacion(kmTotal),
    })
    .returning();
  return row;
}
