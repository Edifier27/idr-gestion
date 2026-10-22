import { asegurarTablaEvidencia } from "@/lib/db/asegurar-evidencia";
import { asegurarColumnaDescargo } from "@/lib/db/asegurar-descargo";
import { asegurarTablasGmail } from "@/lib/db/asegurar-gmail";
import { asegurarColumnaRelatoDenuncia } from "@/lib/db/asegurar-relato-denuncia";
import { asegurarColumnaInformeFinal } from "@/lib/db/asegurar-informe-final";
import { asegurarColumnasEtapaContacto } from "@/lib/db/asegurar-etapa-contacto";
import { asegurarColumnaGmailMensajeId } from "@/lib/db/asegurar-gmail-mensaje-id";
import { asegurarColumnaGmailConexionUsuario } from "@/lib/db/asegurar-usuario-gmail-conexion";
import { asegurarColumnasDerivadoAdmin } from "@/lib/db/asegurar-derivado-admin";
import { asegurarTablaDatoExtra } from "@/lib/db/asegurar-dato-extra";
import { asegurarColumnaFechaDesistido } from "@/lib/db/asegurar-fecha-desistido";
import { asegurarColumnasComunicacion } from "@/lib/db/asegurar-comunicacion";
import { asegurarColumnaRecordatorioPlazo } from "@/lib/db/asegurar-recordatorio-plazo";
import { asegurarColumnaZonaUsuario } from "@/lib/db/asegurar-zona-usuario";
import { asegurarTablaReporteProblema } from "@/lib/db/asegurar-reporte-problema";

// Aplica todos los cambios de esquema pendientes (columnas o tablas nuevas).
// Idempotente. Lo usan /api/migrar y la importación de planillas (que inserta
// casos con todas las columnas del schema, así que tienen que existir).
export async function asegurarEsquema() {
  await asegurarTablaEvidencia();
  await asegurarColumnaDescargo();
  await asegurarTablasGmail();
  await asegurarColumnaRelatoDenuncia();
  await asegurarColumnaInformeFinal();
  await asegurarColumnasEtapaContacto();
  await asegurarColumnaGmailMensajeId();
  await asegurarColumnaGmailConexionUsuario();
  await asegurarColumnasDerivadoAdmin();
  await asegurarTablaDatoExtra();
  await asegurarColumnaFechaDesistido();
  await asegurarColumnasComunicacion();
  await asegurarColumnaRecordatorioPlazo();
  await asegurarColumnaZonaUsuario();
  await asegurarTablaReporteProblema();
}
