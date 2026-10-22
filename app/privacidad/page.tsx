import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidad — IDR Gestión" };

// Página pública que pide Google para publicar la app de OAuth ("En
// producción") con la que el CRM se conecta a Gmail. Si cambia qué se hace
// con los mails, actualizar este texto.
export default function Privacidad() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-ink md:py-16">
      <a href="/" className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">IDR Gestión</a>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Política de privacidad</h1>
      <p className="mt-1 text-sm text-slate">Última actualización: 22 de octubre de 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="mb-2 text-base font-semibold">Quiénes somos</h2>
          <p>IDR Gestión investiga siniestros para compañías aseguradoras. Este sitio y su sistema interno de gestión (CRM) son de uso exclusivo de IDR Gestión y su equipo.</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold">Uso de Gmail</h2>
          <p>Un usuario del equipo puede conectar su casilla de Gmail al CRM. Con su autorización, el CRM:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>lee los mails de la bandeja de entrada para mostrarlos dentro del CRM y crear casos a partir de los que mandan las aseguradoras (por ejemplo, el PDF de carátula);</li>
            <li>envía mails desde esa casilla cuando el usuario lo pide (por ejemplo, el informe de un caso a la aseguradora).</li>
          </ul>
          <p className="mt-2">Solo se guarda el permiso de acceso de Google (token) y los datos de los casos que el usuario decide crear. No se venden, comparten ni usan los datos de Gmail para publicidad ni para ningún otro fin. El uso de la información recibida de las API de Google cumple con la <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy">Política de datos de usuario de los servicios de las API de Google</a>, incluidos los requisitos de uso limitado.</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold">Datos de los casos</h2>
          <p>Los datos de los siniestros (denunciante, contacto, domicilio, pruebas) se usan solo para la investigación encargada por la aseguradora, se guardan en servidores con acceso restringido al equipo y se tratan conforme a la Ley 25.326 de Protección de Datos Personales.</p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-semibold">Revocar el acceso</h2>
          <p>Quien conectó su Gmail puede quitar el acceso en cualquier momento desde <a className="underline" href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>. Para pedir la baja de datos, escribinos por los canales de contacto de la página principal.</p>
        </section>
      </div>
    </main>
  );
}
