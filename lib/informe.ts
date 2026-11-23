import Anthropic from "@anthropic-ai/sdk";
import type { SiniestroRow } from "./db/schema";
import type { LecturaDenuncia } from "./leer-denuncia";

// Genera un borrador de informe técnico-legal del siniestro a partir de los
// datos cargados + las notas de la bitácora. Es un borrador para revisar, no
// un dictamen final.
export async function generarInforme(s: SiniestroRow, notas: string[], lectura: LecturaDenuncia | null = null, pruebas: { cargadas: string[]; delRamo: string[] } | null = null): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurada.");
  const client = new Anthropic({ apiKey });

  const lugar = (s.lugarSiniestro ?? {}) as Record<string, string>;
  const contexto = {
    siniestro: s.nroSiniestro,
    tipo: s.tipo,
    aseguradora: s.compania,
    asegurado: s.asegurado,
    denunciante: s.denunciante,
    fechaOcurrencia: s.fechaOcurrencia,
    domicilio: s.domicilio,
    lugarHecho: [lugar.calle1, lugar.altura1, lugar.localidad, lugar.provincia].filter(Boolean).join(" "),
    resultado: s.resultado,
    relatoDenuncia: s.relatoDenuncia,
    // Lo que la IA leyó de los documentos (lib/leer-denuncia.ts): la
    // ampliación del asegurado y la denuncia policial por separado, más el
    // cotejo de la denuncia contra los datos del siniestro.
    ampliacionAsegurado: lectura?.ampliacion ?? null,
    denunciaPolicial: lectura?.denuncia ?? null,
    denunciaVsSiniestro: lectura ? { cotejo: lectura.cotejo, alertas: lectura.alertas } : null,
    descargoInvestigador: s.descargo,
    pruebasCargadas: pruebas?.cargadas ?? null,
    pruebasQuePideElRamo: pruebas?.delRamo ?? null,
    notasInspeccion: notas,
  };

  const msg = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1600,
    system:
      "Sos un perito liquidador de siniestros en Argentina, especializado en detección de fraude. " +
      "Redactás un cotejo BREVE, no un informe largo — los datos del siniestro (aseguradora, asegurado, fechas, " +
      "etc.) ya se ven en el sistema, así que NO los repitas. Estructura, corta y concreta: " +
      "1) Cotejo (viñetas cortas, no prosa larga): comparación punto por punto entre la denuncia policial " +
      "(denunciaPolicial), la ampliación del asegurado (ampliacionAsegurado; si no están, usá relatoDenuncia) y lo que " +
      "relevó el operador (descargoInvestigador y notasInspeccion) — marcá qué coincide y, sobre todo, cualquier " +
      "inconsistencia entre las denuncias y la ampliación, contradicción o dato que no se pueda verificar. Sumá las " +
      "diferencias de denunciaVsSiniestro si las hay. 2) Conclusión: 1-2 líneas, si lo relevado sostiene o contradice lo denunciado. " +
      "3) Interrogantes sugeridos: lista numerada de preguntas concretas para la entrevista o re-entrevista del " +
      "asegurado (y de testigos o comercios que se mencionen), apuntadas a aclarar las inconsistencias y los puntos " +
      "sin verificar; y aparte, 'Pruebas a pedir': las de pruebasQuePideElRamo que no estén en pruebasCargadas, más " +
      "cualquier otra que sirva para este caso puntual. " +
      "4) Sugerencia de redacción para el mail de cierre a la aseguradora: un párrafo breve (3-4 líneas), en tono " +
      "profesional y listo para pegar en el cuerpo del mail — esto es lo que el perito va a copiar y mandar, no " +
      "repitas el análisis de arriba. " +
      "Total del informe: apuntá a media página, no más. Español rioplatense formal. Es un BORRADOR para que el " +
      "perito revise y ajuste; no inventes hechos que no estén en los datos: si falta relatoDenuncia o " +
      "descargoInvestigador, indicá 'a completar' en esa sección en vez de inventar contenido.",
    messages: [
      { role: "user", content: `Redactá el cotejo con estos datos:\n${JSON.stringify(contexto, null, 2)}` },
    ],
  });

  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
