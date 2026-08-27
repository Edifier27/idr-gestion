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
  fechaLimite: text("fecha_limite"),                       // vencimiento de la gestión
  estadoCobro: text("estado_cobro").notNull().default("no_facturado"), // no_facturado|facturado|presentado|cobrado|rechazado
  kmTotal: integer("km_total"),
  facturar: integer("facturar"),
  numeroFc: text("numero_fc"),
  gastoFijo: integer("gasto_fijo"),
  operador: text("operador"),
  informe: text("informe"),                                // informe técnico-legal (borrador del operador, IA) — visible para admin y operador
  informeFinal: text("informe_final"),                     // resolución final que arma el admin — solo la ve el admin
  descargo: text("descargo"),                              // relato de lo sucedido, a cargo del operador

  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
});

// Bitácora: registro de gestiones (llamados, visitas, notas) por siniestro.
export const bitacora = pgTable("bitacora", {
  id: uuid("id").primaryKey().defaultRandom(),
  siniestroId: uuid("siniestro_id").notNull(),
  fecha: timestamp("fecha", { withTimezone: true }).notNull().defaultNow(),
  tipo: text("tipo").notNull().default("nota"),  // nota|llamado|visita|mail
  nota: text("nota").notNull(),
});

// Usuarios del CRM (login). Los crea el admin a mano; no hay alta pública.
export const usuarios = pgTable("usuarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  nombre: text("nombre").notNull(),
  rol: text("rol").notNull().default("vendedor"), // admin|vendedor
  operador: text("operador"), // vincula al campo "operador" de siniestros; null para admin
  activo: boolean("activo").notNull().default(true),
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

export type SiniestroRow = typeof siniestros.$inferSelect;
export type NuevoSiniestro = typeof siniestros.$inferInsert;
export type BitacoraRow = typeof bitacora.$inferSelect;
export type UsuarioRow = typeof usuarios.$inferSelect;
export type NuevoUsuario = typeof usuarios.$inferInsert;
export type EvidenciaRow = typeof evidencia.$inferSelect;
export type GmailConexionRow = typeof gmailConexion.$inferSelect;
export type MailEnviadoRow = typeof mailEnviado.$inferSelect;
