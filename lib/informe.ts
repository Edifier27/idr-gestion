import Anthropic from "@anthropic-ai/sdk";
import type { SiniestroRow } from "./db/schema";

// Genera un borrador de informe técnico-legal del siniestro a partir de los
// datos cargados + las notas de la bitácora. Es un borrador para revisar, no
// un dictamen final.
export async function generarInforme(s: SiniestroRow, notas: string[]): Promise<string> {
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
    descargoInvestigador: s.descargo,
    notasInspeccion: notas,
  };

  const msg = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    system:
      "Sos un perito liquidador de siniestros en Argentina, especializado en detección de fraude. " +
      "Redactás informes técnico-legales claros, formales y objetivos. Estructura: " +
      "1) Datos del siniestro, 2) Antecedentes (según relatoDenuncia, lo que declaró el asegurado/denunciante), " +
      "3) Verificaciones realizadas (según descargoInvestigador y notasInspeccion, lo que relevó el investigador en el terreno), " +
      "4) Cotejo entre lo denunciado y lo relevado (comparación punto por punto de relatoDenuncia contra " +
      "descargoInvestigador y notasInspeccion — señalá explícitamente las coincidencias y, sobre todo, cualquier " +
      "inconsistencia, contradicción o dato que no pueda verificarse), 5) Conclusión/dictamen (si lo relevado " +
      "sostiene o contradice lo denunciado). Escribí en español rioplatense formal. Es un BORRADOR para que el " +
      "perito revise y ajuste; no inventes hechos que no estén en los datos: si falta relatoDenuncia o " +
      "descargoInvestigador, indicá 'a completar' en esa sección en vez de inventar contenido.",
    messages: [
      { role: "user", content: `Redactá el informe con estos datos:\n${JSON.stringify(contexto, null, 2)}` },
    ],
  });

  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
