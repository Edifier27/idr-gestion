// Genera public/emoji/<codigo>.svg con los emojis de Fluent Emoji (Microsoft,
// licencia MIT) y lib/emoji-disponibles.ts con la lista de los que hay.
// Se incluye una selección (caras, manos, lo que usa el CRM y el selector de
// emojis del WhatsApp) para no subir 27 MB; el resto se ve con el emoji del
// sistema. Correr: node scripts/generar-emojis.mjs
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fluent = JSON.parse(fs.readFileSync(path.join(raiz, "node_modules/@iconify-json/fluent-emoji/icons.json"), "utf8"));
const unicode = JSON.parse(fs.readFileSync(path.join(raiz, "node_modules/unicode-emoji-json/data-by-emoji.json"), "utf8"));
const EXTRA = { "🕓": "four-oclock", "😡": "pouting-face", "🤗": "hugging-face" };

const RX = /\p{Extended_Pictographic}(\u{FE0F}|\u{200D}\p{Extended_Pictographic}\u{FE0F}?)*/gu;
const enCodigo = new Set();
for (const dir of ["app", "components", "lib"]) {
  const recorrer = d => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) recorrer(p);
      else if (/\.(tsx?|css)$/.test(f.name) && !f.name.startsWith("emoji-disponibles")) for (const m of fs.readFileSync(p, "utf8").match(RX) ?? []) enCodigo.add(m);
    }
  };
  recorrer(path.join(raiz, dir));
}

const SUBGRUPOS = new Set(["hand-fingers-open", "hand-fingers-partial", "hand-single-finger", "hand-fingers-closed", "hands", "hand-prop", "body-parts", "person-gesture", "heart", "emotion"]);
export const clave = e => [...e.replace(/\u{FE0F}/gu, "")].map(c => c.codePointAt(0).toString(16)).join("-");

const elegidos = new Map();
for (const [e, v] of Object.entries(unicode)) {
  const incluir = v.group === "Smileys & Emotion" || (v.group === "People & Body" && SUBGRUPOS.has(v.subgroup ?? "")) || enCodigo.has(e) || enCodigo.has(e.replace(/\u{FE0F}/gu, ""));
  if (incluir) elegidos.set(clave(e), v.slug.replace(/_/g, "-"));
}
for (const e of enCodigo) if (!elegidos.has(clave(e))) {
  const v = unicode[e] ?? unicode[e + "️"];
  if (v) elegidos.set(clave(e), v.slug.replace(/_/g, "-"));
}
for (const [e, s] of Object.entries(EXTRA)) elegidos.set(clave(e), s);

const salida = path.join(raiz, "public/emoji");
fs.rmSync(salida, { recursive: true, force: true });
fs.mkdirSync(salida, { recursive: true });
const hechos = [];
for (const [k, slug] of elegidos) {
  const nombre = fluent.icons[slug] ? slug : fluent.aliases?.[slug]?.parent;
  const icono = nombre && fluent.icons[nombre];
  if (!icono) continue;
  const w = icono.width ?? fluent.width ?? 32, h = icono.height ?? fluent.height ?? 32;
  fs.writeFileSync(path.join(salida, `${k}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${icono.body}</svg>`);
  hechos.push(k);
}
fs.writeFileSync(path.join(raiz, "lib/emoji-disponibles.ts"),
  `// Generado por scripts/generar-emojis.mjs — no editar a mano.\nexport const EMOJI_DISPONIBLES = new Set<string>(${JSON.stringify(hechos.sort())});\n`);
console.log(`${hechos.length} emojis generados`);
