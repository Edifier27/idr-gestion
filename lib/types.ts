// Tipos centrales del CRM de siniestros.
// Los campos que salen del PDF de carátula (por LLM) están en CaratulaExtraida.
// El resto (km, facturación, gestión interna) se calcula o se carga en el CRM.

export type EstadoSiniestro =
  | "ingresado"
  | "en_gestion"
  | "inspeccionado"
  | "elevado"
  | "facturado"
  | "cerrado";

export type ResultadoInvestigacion = "pendiente" | "sin_fraude" | "con_fraude" | "sin_cobertura";

// Lo que el LLM extrae del PDF de carátula (banca los dos formatos).
export interface CaratulaExtraida {
  nro_siniestro: string | null;
  numero_gestion: string | null; // viene en el PDF; identifica la gestión
  compania: string | null; // aseguradora / cliente, ej. ATM
  rama: string | null; // ej. MOTOVEHICULOS
  tipo: string | null; // ej. ROBO TOTAL / PARCIAL
  poliza: string | null;
  asegurado: string | null;
  denunciante: string | null;
  dni: string | null;
  email_contacto: string | null;
  tel_contacto: string | null;
  cel_contacto: string | null;
  tel: string | null;
  domicilio: string | null;
  estado_origen: string | null; // ej. En Trámite (estado que trae la aseguradora)
  fecha_ingreso: string | null; // YYYY-MM-DD
  fecha_ocurrencia: string | null; // YYYY-MM-DD
  hora_ocurrencia: string | null; // HH:MM
  fecha_denuncia: string | null; // YYYY-MM-DD
  lugar_siniestro: {
    calle1: string | null;
    altura1: string | null;
    calle2: string | null;
    altura2: string | null;
    localidad: string | null;
    provincia: string | null;
    comisaria: string | null;
    acta: string | null;
    sumario: string | null;
  };
}

// El registro completo tal como vive en el CRM.
export interface Siniestro extends CaratulaExtraida {
  id: string;
  estado: EstadoSiniestro;
  resultado: ResultadoInvestigacion;
  km_total: number | null; // calculado con Maps API
  facturar: number | null; // calculado con la fórmula
  numero_fc: string | null; // nro de factura emitida
  gasto_fijo: number | null;
  operador: string | null; // quién gestiona (ej. NACHO)
  creado_en: string;
  actualizado_en: string;
}
