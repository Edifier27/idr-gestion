"use client";

// Reemplazo liviano de window.alert/confirm/prompt con el look del resto del
// CRM, sin dependencias nuevas. Patrón "imperativo con host único": se monta
// <NotificacionesHost /> una sola vez (en AppShell) y desde cualquier
// componente se llama a notificar.ok(...)/confirmar(...)/pedirTexto(...) sin
// tener que envolver nada en contexto ni pasar props.

import { useEffect, useState } from "react";
import { boton, campo } from "@/lib/ui";

// --- Toasts ---
type Toast = { id: number; tipo: "ok" | "error"; texto: string };
let toasts: Toast[] = [];
let toastListeners: Array<() => void> = [];
let toastId = 0;

function emitToasts() { toastListeners.forEach(l => l()); }

function pushToast(tipo: Toast["tipo"], texto: string) {
  const id = ++toastId;
  toasts = [...toasts, { id, tipo, texto }];
  emitToasts();
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    emitToasts();
  }, 4000);
}

export const notificar = {
  ok: (texto: string) => pushToast("ok", texto),
  error: (texto: string) => pushToast("error", texto),
};

// --- Confirmar (reemplaza window.confirm) ---
type ConfirmState = { texto: string; textoConfirmar: string; peligroso: boolean; resolve: (v: boolean) => void } | null;
let confirmState: ConfirmState = null;
let confirmListeners: Array<() => void> = [];
function emitConfirm() { confirmListeners.forEach(l => l()); }

export function confirmar(texto: string, opts?: { textoConfirmar?: string; peligroso?: boolean }): Promise<boolean> {
  return new Promise(resolve => {
    confirmState = { texto, textoConfirmar: opts?.textoConfirmar ?? "Confirmar", peligroso: opts?.peligroso ?? false, resolve };
    emitConfirm();
  });
}

// --- Pedir texto (reemplaza window.prompt) ---
type PromptState = { titulo: string; placeholder?: string; tipo?: "text" | "password"; resolve: (v: string | null) => void } | null;
let promptState: PromptState = null;
let promptListeners: Array<() => void> = [];
function emitPrompt() { promptListeners.forEach(l => l()); }

export function pedirTexto(titulo: string, opts?: { placeholder?: string; tipo?: "text" | "password" }): Promise<string | null> {
  return new Promise(resolve => {
    promptState = { titulo, placeholder: opts?.placeholder, tipo: opts?.tipo ?? "text", resolve };
    emitPrompt();
  });
}

function useForceUpdate() {
  const [, setTick] = useState(0);
  return () => setTick(t => t + 1);
}

export function NotificacionesHost() {
  const forceToasts = useForceUpdate();
  const forceConfirm = useForceUpdate();
  const forcePrompt = useForceUpdate();
  const [valorPrompt, setValorPrompt] = useState("");

  useEffect(() => {
    toastListeners.push(forceToasts);
    confirmListeners.push(forceConfirm);
    promptListeners.push(forcePrompt);
    return () => {
      toastListeners = toastListeners.filter(l => l !== forceToasts);
      confirmListeners = confirmListeners.filter(l => l !== forceConfirm);
      promptListeners = promptListeners.filter(l => l !== forcePrompt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (promptState) setValorPrompt("");
  }, [promptState]);

  function responderConfirm(v: boolean) {
    confirmState?.resolve(v);
    confirmState = null;
    emitConfirm();
  }
  function responderPrompt(v: string | null) {
    promptState?.resolve(v);
    promptState = null;
    emitPrompt();
  }

  return (
    <>
      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-xs flex-col gap-2">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-2 rounded-lg border bg-white px-3.5 py-2.5 text-sm font-medium shadow-lg ${
                t.tipo === "ok" ? "border-ok/30 text-ok" : "border-fraude/30 text-fraude"
              }`}
            >
              <span aria-hidden>{t.tipo === "ok" ? "✓" : "⚠"}</span>
              <span className="text-ink">{t.texto}</span>
            </div>
          ))}
        </div>
      )}

      {/* Confirmar */}
      {confirmState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4" onClick={() => responderConfirm(false)}>
          <div className="w-full max-w-sm rounded-xl border border-line bg-white p-5 shadow-lg" onClick={e => e.stopPropagation()}>
            <p className="text-sm leading-relaxed text-ink">{confirmState.texto}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => responderConfirm(false)} className={boton.ghost}>Cancelar</button>
              <button
                onClick={() => responderConfirm(true)}
                className={confirmState.peligroso
                  ? "inline-flex items-center justify-center gap-1.5 rounded-md bg-fraude px-3.5 py-2 text-sm font-medium text-paper shadow-sm transition hover:opacity-90"
                  : boton.primario}
              >
                {confirmState.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pedir texto */}
      {promptState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4" onClick={() => responderPrompt(null)}>
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={e => { e.preventDefault(); responderPrompt(valorPrompt); }}
            className="w-full max-w-sm rounded-xl border border-line bg-white p-5 shadow-lg"
          >
            <p className="mb-2 text-sm font-medium text-ink">{promptState.titulo}</p>
            <input
              autoFocus
              type={promptState.tipo}
              value={valorPrompt}
              onChange={e => setValorPrompt(e.target.value)}
              placeholder={promptState.placeholder}
              className={`w-full ${campo}`}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => responderPrompt(null)} className={boton.ghost}>Cancelar</button>
              <button type="submit" className={boton.primario}>Confirmar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
