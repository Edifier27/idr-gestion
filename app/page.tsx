const TELEFONO = "+54 9 11 2193-9705";
const TEL_HREF = "tel:+5491121939705";
const WSP_HREF = "https://wa.me/5491121939705";

const SERVICIOS = [
  { titulo: "Relevamientos e investigaciones integrales", texto: "Constatación técnica presencial o virtual del siniestro, con relevamiento fotográfico, entrevistas y recolección de evidencia conforme a protocolo." },
  { titulo: "Detección de fraude", texto: "Análisis de consistencia entre lo declarado y la evidencia relevada, para identificar irregularidades con criterio técnico y objetivo." },
  { titulo: "Robo total, parcial y de ruedas", texto: "Investigación de siniestros de robo o hurto de vehículos, totales, parciales y de ruedas, con relevamiento de circunstancias y evidencia disponible." },
  { titulo: "Daños e incendios", texto: "Investigación de siniestros de incendio y daños materiales, con relevamiento fotográfico y análisis de las circunstancias declaradas." },
  { titulo: "Lesiones, ART y AP", texto: "Relevamiento e investigación de siniestros con lesiones personales, casos de ART y accidentes personales, con una mirada cercana y respetuosa." },
  { titulo: "Riesgos varios y casos especiales", texto: "Investigaciones a medida para siniestros que no encuadran en una categoría estándar: responsabilidad civil, transporte, caución y otros riesgos especiales." },
];

const ZONAS = [
  { nombre: "Zona Sur", detalle: "9 partidos/comunas", stat: "~32%", nota: "de los robos de vehículos registrados en el AMBA durante 2025" },
  { nombre: "Capital Federal (CABA)", detalle: "15 partidos/comunas", stat: "~12%", nota: "de los robos de vehículos del AMBA; mayor incidencia vial en Comuna 9 y Comuna 7" },
  { nombre: "Zona Oeste", detalle: "5 partidos/comunas", stat: "~49%", nota: "de los robos de vehículos del AMBA en 2025 — la zona con mayor incidencia" },
];

const NUMEROS = [
  { valor: "+1.000", label: "casos gestionados para compañías aseguradoras" },
  { valor: "33%", label: "efectividad promedio en detección de casos sin efecto" },
  { valor: "6", label: "áreas de especialización en investigación de siniestros" },
  { valor: "Nacional", label: "cobertura, con red de investigadores en expansión" },
];

const VALORES = [
  { titulo: "Profesionalismo", texto: "Informes e investigaciones diseñados según las necesidades específicas de cada cliente, con rigor técnico en cada etapa." },
  { titulo: "Integridad", texto: "Conclusiones sustentadas en evidencia verificable, con una mirada objetiva que respalda cada decisión de la compañía." },
  { titulo: "Solidaridad", texto: "Vínculos de confianza construidos con cercanía, comunicación fluida y cumplimiento de cada compromiso asumido." },
  { titulo: "Empatía", texto: "Trato cercano y respetuoso en cada intervención, especialmente en los casos que involucran a personas y sus circunstancias." },
];

const TESTIMONIOS = [
  { texto: "Encontramos en el equipo un aliado estratégico. Siempre dispuestos, claros en la comunicación y con informes que realmente aportan valor para la toma de decisiones.", autor: "Coordinador de Siniestros", empresa: "Compañía de Seguros Nacional" },
  { texto: "Cumplen con lo que prometen: informes de calidad, contacto permanente y resultados concretos.", autor: "Área Técnica", empresa: "Aseguradora del Interior" },
];

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <TrustBar />
      <Servicios />
      <Cobertura />
      <Valores />
      <Testimonios />
      <ContactoCTA />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <a href="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-paper">IDR Gestión</a>
        <nav className="hidden items-center gap-6 text-sm text-paper/70 md:flex">
          <a href="#servicios" className="hover:text-paper">Servicios</a>
          <a href="#cobertura" className="hover:text-paper">Cobertura</a>
          <a href="#nosotros" className="hover:text-paper">Nosotros</a>
          <a href="#contacto" className="hover:text-paper">Contacto</a>
        </nav>
        <a href="/login" className="rounded border border-amber/50 px-3 py-1.5 text-sm font-medium text-amber transition hover:bg-amber hover:text-ink">
          Iniciar sesión
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-ink px-4 py-20 md:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-amber">Estudio de investigación de siniestros</p>
        <h1 className="text-3xl font-semibold leading-tight text-paper md:text-5xl">
          Informes e investigaciones de siniestros con calidad y compromiso real
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-paper/70">
          Somos un equipo joven, flexible y comprometido, dedicado a brindar informes e investigaciones de calidad para compañías aseguradoras, diseñados según las necesidades de cada cliente. Confianza, agilidad y compromiso en cada informe.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href={TEL_HREF} className="rounded bg-amber px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90">
            Solicitar una propuesta
          </a>
          <a href="#servicios" className="rounded border border-paper/30 px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-paper/10">
            Conocer nuestros servicios
          </a>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  return (
    <section className="border-b border-line bg-paper py-8">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate">Compañías aseguradoras que confían en nuestro trabajo</p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-slate/70">
          {["Aseguradora A","Aseguradora B","Aseguradora C","Aseguradora D","Aseguradora E","Aseguradora F"].map(n => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Servicios() {
  return (
    <section id="servicios" className="mx-auto max-w-6xl px-4 py-20">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber">Qué hacemos</p>
      <h2 className="mb-3 text-2xl font-semibold text-ink md:text-3xl">Áreas de especialización</h2>
      <p className="mb-10 max-w-2xl text-slate">Brindamos soluciones ágiles y precisas en investigaciones presenciales y virtuales, adaptadas a cada tipo de siniestro.</p>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {SERVICIOS.map(s => (
          <div key={s.titulo} className="rounded-lg border border-line bg-white p-5">
            <h3 className="mb-2 font-semibold text-ink">{s.titulo}</h3>
            <p className="text-sm text-slate">{s.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Cobertura() {
  return (
    <section id="cobertura" className="bg-ink px-4 py-20 text-paper">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber">Dónde trabajamos</p>
        <h2 className="mb-3 text-2xl font-semibold md:text-3xl">Cobertura territorial en el AMBA</h2>
        <p className="mb-10 max-w-2xl text-paper/70">
          Realizamos relevamientos e investigaciones presenciales en 29 partidos y comunas de Zona Sur, Capital Federal y Zona Oeste — precisamente las áreas de mayor concentración de siniestralidad automotor del Área Metropolitana de Buenos Aires.
        </p>

        <div className="mb-12 grid gap-5 md:grid-cols-3">
          {ZONAS.map(z => (
            <div key={z.nombre} className="rounded-lg border border-white/10 bg-white/5 p-5">
              <h3 className="font-semibold text-paper">{z.nombre}</h3>
              <p className="mb-3 text-xs text-paper/50">{z.detalle}</p>
              <p className="tnum text-2xl font-bold text-amber">{z.stat}</p>
              <p className="mt-1 text-xs text-paper/60">{z.nota}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5 border-t border-white/10 pt-10 md:grid-cols-4">
          {NUMEROS.map(n => (
            <div key={n.label}>
              <p className="tnum text-2xl font-bold text-paper md:text-3xl">{n.valor}</p>
              <p className="mt-1 text-xs text-paper/60">{n.label}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-xs text-paper/40">
          * Porcentajes de referencia sobre siniestralidad regional (no representan el volumen de casos gestionados por IDR Gestión), en base a datos de robo de vehículos en AMBA relevados por 100% Seguro y datos de siniestralidad vial por comuna del Observatorio de Movilidad y Seguridad Vial (GCBA).
        </p>
      </div>
    </section>
  );
}

function Valores() {
  return (
    <section id="nosotros" className="mx-auto max-w-6xl px-4 py-20">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber">Nuestros valores fundamentales</p>
      <h2 className="mb-3 text-2xl font-semibold text-ink md:text-3xl">Lo que guía nuestro trabajo diario</h2>
      <p className="mb-10 max-w-2xl text-slate">Profesionalismo, Integridad, Solidaridad y Empatía definen nuestra cultura organizacional y se reflejan en cada informe que entregamos.</p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {VALORES.map(v => (
          <div key={v.titulo} className="rounded-lg border border-line bg-white p-5">
            <h3 className="mb-2 font-semibold text-ink">{v.titulo}</h3>
            <p className="text-sm text-slate">{v.texto}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonios() {
  return (
    <section className="bg-paper px-4 py-20">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber">Testimonios de confianza</p>
        <h2 className="mb-10 text-2xl font-semibold text-ink md:text-3xl">Lo que dicen quienes trabajan con nosotros</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {TESTIMONIOS.map(t => (
            <blockquote key={t.autor} className="rounded-lg border border-line bg-white p-6">
              <p className="text-ink">&ldquo;{t.texto}&rdquo;</p>
              <footer className="mt-4 text-sm text-slate">
                <span className="font-medium text-ink">{t.autor}</span> · {t.empresa}
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactoCTA() {
  return (
    <section id="contacto" className="bg-ink px-4 py-20 text-center text-paper">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-2xl font-semibold md:text-3xl">Hablemos hoy. Tu próximo caso puede tener una mejor resolución con nosotros.</h2>
        <p className="mt-4 text-paper/70">Contactanos para conocer más sobre nuestros servicios o solicitar una propuesta personalizada.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href={TEL_HREF} className="rounded bg-amber px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90">
            Contactar al equipo
          </a>
          <a href={WSP_HREF} target="_blank" rel="noopener noreferrer" className="rounded border border-paper/30 px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-paper/10">
            WhatsApp
          </a>
        </div>
        <p className="mt-6 text-sm text-paper/50">{TELEFONO}</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-paper px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-slate md:flex-row">
        <p>© {new Date().getFullYear()} IDR Gestión — Investigación de siniestros</p>
        <a href="/login" className="text-ink underline-offset-2 hover:underline">Acceso al CRM</a>
      </div>
    </footer>
  );
}
