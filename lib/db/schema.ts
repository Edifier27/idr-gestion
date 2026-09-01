import { pgTable, text, integer, timestamp, jsonb, uuid, boolean } from "drizzle-orm/pg-core";

export const siniestros = pgTable("siniestros", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Datos del PDF de carátula (extraídos por LLM)
  nroSiniestro: text("nro_siniestro"),
  numeroGestion: text("numero_gestion"),
  compania: text("compania"),
  rama: text("rama"),
  tipo: text("tipo"),
  poliza: text("poliza"),
  asegurado: text("asegurado"),
  denunciante: text("denunciante"),
  dni: text("dni"),
  emailContacto: text("email_contacto"),
  telContacto: text("tel_contacto"),
  celContacto: text("cel_contacto"),
  tel: text("tel"),
  domicilio: text("domicilio"),
  estadoOrigen: text("estado_origen"),
  fechaIngreso: text("fecha_ingreso"),
  fechaOcurrencia: text("fecha_ocurrencia"),
  horaOcurrencia: text("hora_ocurrencia"),
  fechaDenuncia: text("fecha_denuncia"),
  lugarSiniestro: jsonb("lugar_siniestro"),
  relatoDenuncia: text("relato_denuncia"),                  // qué dice la denuncia que pasó (extraído por LLM)

  // Gestión interna
  estado: text("estado").notNull().default("ingresado"),
  resultado: text("resultado").notNull().default("pendiente"),
  // Momento exacto en que "resultado" pasó a "desistido" — no alcanza con
  // actualizado_en, que se pisa con cualquier otro cambio posterior al caso.
  // La usa el ranking de operadores para filtrar por mes.
  fechaDesistido: timestamp("fecha_desistido", { withTimezone: true }),
  fechaLimite: text("fecha_limite"),                       // vencimiento de la gestión
  // Cuándo se le mandó al operador el mail automático de "se acerca el
  // vencimiento del informe" (Cron diario, ver app/api/recordatorio-plazo) —
  // para no mandarlo de nuevo por el mismo caso.
  recordatorioPlazoEnviadoEn: timestamp("recordatorio_plazo_enviado_en", { withTimezone: true }),
  estadoCobro: text("estado_cobro").notNull().default("no_facturado"), // no_facturado|facturado|presentado|cobrado|rechazado
  kmTotal: integer("km_total"),
  facturar: integer("facturar"),
  numeroFc: text("numero_fc"),
  gastoFijo: integer("gasto_fijo"),
  operador: text("operador"),
  informe: text("informe"),                                // informe técnico-legal (borrador del operador, IA) — visible para admin y operador
  informeFinal: text("informe_final"),                     // resolución final que arma el admin — solo la ve el admin
  descargo: text("descargo"),                              // relato de lo sucedido, a cargo del operador

  // Seguimiento operativo día a día (contacto → entrevista → informe), aparte
  // del "estado" administrativo/facturación de arriba. null = sin iniciar.
  etapaContacto: text("etapa_contacto"),                   // contacto_fallido|contactado|entrevista_pactada|informe_enviado
  fechaEntrevista: timestamp("fecha_entrevista", { withTimezone: true }), // dispara la alarma de 48hs para el informe
  motivoContacto: text("motivo_contacto"),                 // por qué falló el contacto (ej. "no coincide el DNI") — le avisa al admin

  // El operador deriva el caso al admin cuando no logra contactar al
  // denunciante — le devuelve el trámite para que lo tome directamente.
  // Se limpia solo cuando el contacto se logra (etapa_contacto pasa a
  // "contactado" o más adelante).
  derivadoAdmin: boolean("derivado_admin").notNull().default(false),
  derivadoEn: timestamp("derivado_en", { withTimezone: true }),

  gmailMensajeId: text("gmail_mensaje_id"),                // id del mail de Gmail del que se importó (si vino de la bandeja) — evita duplicados y marca en la bandeja qué mails ya se cargaron

  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
});

// Bitácora: registro de gestiones (llamados, visitas, notas) por siniestro —
// y también el canal de comunicación entre admin y operador dentro de cada
// caso (autor/autorEsAdmin/leida), para no depender de WhatsApp/mail
// personal para el ida y vuelta puntual de un caso.
export const bitacora = pgTable("bitacora", {
  id: uuid("id").primaryKey().defaultRandom(),
  siniestroId: uuid("siniestro_id").notNull(),
  fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  tipo: text("tipo").notNull().default("nota"),  // nota|llamado|visita|mail|devolucion|pedido_ayuda
  nota: text("nota").notNull(),
  autor: text("autor"),                          // nombre de quien la escribió (null = entradas viejas o automáticas del sistema)
  autorEsAdmin: boolean("autor_es_admin"),        // para saber a quién le toca "leerla" (el otro rol)
  leida: boolean("leida").notNull().default(false), // se pone en true sola cuando el otro rol abre el caso
});

// Usuarios del CRM (login). Los crea el admin a mano; no hay alta pública.
export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nombre: text("nombre").notNull(),
  rol: text("rol").notNull().default("vendedor"), // admin|vendedor
  operador: text("operador"), // vincula al campo "operador" de siniestros; null para admin
  email: text("email"), // mail personal del operador — a este le llega el aviso automático cuando le asignan un caso
  activo: boolean("activo").notNull().default(true),
  gmailConexionId: uuid("gmail_conexion_id"), // qué casilla de gmail_conexion usa este usuario para ver su bandeja/importar/mandar mail; null = ninguna asignada
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

// Evidencia: fotos y documentos adjuntos a un siniestro. El archivo en sí
// vive en Vercel Blob; acá solo guardamos el puntero. Disponible para todos
// los roles (no es dato de facturación).
export const evidencia = pgTable("evidencia", {
  id: uuid("id").primaryKey().defaultRandom(),
  siniestroId: uuid("siniestro_id").notNull(),
  nombre: text("nombre").notNull(),      // nombre de archivo original
  url: text("url").notNull(),            // URL pública en Vercel Blob
  tipo: text("tipo").notNull(),          // mime type
  tamano: integer("tamano"),             // bytes
  categoria: text("categoria"),          // dni|registro_conducir|cedula_vehiculo|denuncia|ampliacion|desiste|geolocalizacion|llamadas|mensajes|fotos|otro
  subidoPor: text("subido_por"),         // username de quien lo subió
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

// Conexión con la casilla de Gmail corporativa (para mandar mails desde el
// CRM). Un solo registro activo a la vez; se pisa cuando se reconecta con
// otra cuenta. El refresh token es lo único que hace falta guardar: los
// access tokens se piden al vuelo cada vez que hay que mandar un mail.
export const gmailConexion = pgTable("gmail_conexion", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  refreshToken: text("refresh_token").notNull(),
  conectadoPor: text("conectado_por"),
  conectadoEn: timestamp("conectado_en", { withTimezone: true }).notNull().defaultNow(),
});

// Registro de mails enviados desde un caso (para trazabilidad, no reemplaza
// la bitácora).
export const mailEnviado = pgTable("mail_enviado", {
  id: uuid("id").primaryKey().defaultRandom(),
  siniestroId: uuid("siniestro_id").notNull(),
  para: text("para").notNull(),
  asunto: text("asunto").notNull(),
  enviadoPor: text("enviado_por"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

// Datos adicionales libres por caso: cuando al admin le falta un dato puntual
// que la IA no extrajo del PDF y no tiene un campo fijo en "siniestros"
// (ej. "Chasis", "Compañía de grúa"), lo agrega acá como etiqueta/valor —
// sin límite, sin tocar el schema cada vez que aparece un dato nuevo.
export const datoExtra = pgTable("dato_extra", {
  id: uuid("id").primaryKey().defaultRandom(),
  siniestroId: uuid("siniestro_id").notNull(),
  etiqueta: text("etiqueta").notNull(),
  valor: text("valor").notNull(),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
});

export type SiniestroRow = typeof siniestros.$inferSelect;
export type NuevoSiniestro = typeof siniestros.$inferInsert;
export type BitacoraRow = typeof bitacora.$inferSelect;
export type UsuarioRow = typeof usuarios.$inferSelect;
export type NuevoUsuario = typeof usuarios.$inferInsert;
export type EvidenciaRow = typeof evidencia.$inferSelect;
export type GmailConexionRow = typeof gmailConexion.$inferSelect;
export type MailEnviadoRow = typeof mailEnviado.$inferSelect;
export type DatoExtraRow = typeof datoExtra.$inferSelect;
