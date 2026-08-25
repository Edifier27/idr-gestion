# CRM ATM — Gestión de siniestros

CRM para perito liquidador de siniestros. Recibe la carátula por mail, extrae los
datos con IA, calcula la facturación por km y centraliza la gestión. El Excel pasa a
ser una **exportación** del CRM, no un segundo sistema en paralelo.

## Arquitectura

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Neon** (Postgres serverless, plan gratis) vía Drizzle ORM
- **Claude API** para el parseo del PDF de carátula (banca los dos formatos)
- **Google Maps** para el km (recorrido base → domicilio → hecho → regreso)

### El flujo

1. Llega el mail con el PDF de carátula.
2. Un botón (Gmail add-on o webhook) manda el PDF a `POST /api/extract`.
3. El LLM devuelve el JSON con los campos → se crea el siniestro en `POST /api/siniestros`.
4. El CRM calcula km y facturación. El operador gestiona el estado.
5. `GET /api/export` baja el Excel con las 22 columnas cuando el cliente lo pida.

> Decisión de diseño: el **CRM es la fuente de verdad**. El mail dispara la creación en
> el CRM (automático o con botón); el Excel se genera a demanda. Mantener dos sistemas
> vivos en sincronía es frágil — una fuente + exportación es lo robusto.

## Estructura

```
app/
  page.tsx                     tablero: stats + tabla de siniestros
  siniestros/[id]/page.tsx     detalle + desglose de facturación
  api/extract/route.ts         PDF -> JSON (LLM)
  api/siniestros/route.ts      listar / crear
  api/siniestros/[id]/route.ts ver / actualizar (recalcula facturación)
  api/export/route.ts          exportar a xlsx
lib/
  facturacion.ts               MAX(0, km-30) * 650 + 50000
  extraction.ts                prompt + llamada a Claude
  db/schema.ts                 tabla siniestros (Drizzle)
```

## Puesta en marcha (cuando estés en casa)

```bash
# 1. Base de datos: creá una gratis en https://neon.tech y copiá el connection string
cp .env.example .env      # y completá DATABASE_URL, ANTHROPIC_API_KEY, GOOGLE_MAPS_API_KEY

# 2. Crear las tablas
npm run db:push

# 3. Correr local
npm run dev

# 4. Subir a GitHub (repo nuevo)
git init && git add -A && git commit -m "CRM ATM inicial"
gh repo create crm-atm --private --source=. --push

# 5. Conectar a Vercel: importás el repo desde vercel.com/new,
#    cargás las mismas variables de entorno, y cada push deploya solo.
```

## Pendiente (próximos pasos)

- Cálculo de km con Maps API (`lib/km.ts`) y auto-recálculo de facturación.
- Generación del PDF de carátula desde los datos del CRM.
- Ingreso automático desde Gmail (webhook / Apps Script → `/api/extract`).
- Fase 3: informe / descargo técnico-legal con IA.
