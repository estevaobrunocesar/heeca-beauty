"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  token: string;
  initialPaymentStatus: string;
  initialAppointmentStatus: string;
  copyPaste: string | null;
  qrCodeBase64: string | null;
  expiresAt: string;
  isMock: boolean;
  confirmUrl: string;
};

/**
 * Exibe o QR Code / copia-e-cola e acompanha o pagamento por polling (a cada 5 s).
 * O webhook do provedor normalmente confirma antes; o polling é a rede de segurança.
 */
export function PixPayment({ token, initialPaymentStatus, initialAppointmentStatus, copyPaste, qrCodeBase64, expiresAt, isMock, confirmUrl }: Props) {
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus);
  const [appointmentStatus, setAppointmentStatus] = useState(initialAppointmentStatus);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [simulating, setSimulating] = useState(false);

  const pending = paymentStatus === "PENDING";
  const paid = paymentStatus === "PAID" || appointmentStatus === "CONFIRMED";
  const remainingMs = new Date(expiresAt).getTime() - now;
  const expired = pending && remainingMs <= 0;

  // Relógio + polling
  useEffect(() => {
    if (!pending) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/public/payment/${token}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { paymentStatus: string; appointmentStatus: string };
        setPaymentStatus(j.paymentStatus);
        setAppointmentStatus(j.appointmentStatus);
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    }, 5000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [pending, token]);

  if (paid) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="text-3xl">✅</div>
        <h2 className="mt-2 text-lg font-semibold text-emerald-900">Pagamento recebido!</h2>
        <p className="mt-1 text-sm text-emerald-800">Seu horário está confirmado. Enviamos os detalhes no WhatsApp.</p>
        <Link href={confirmUrl} className="btn-secondary mt-4 w-full">Ver meu agendamento</Link>
      </div>
    );
  }

  if (expired || paymentStatus === "EXPIRED" || paymentStatus === "CANCELLED" || paymentStatus === "FAILED") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-center">
        <div className="text-3xl">⌛</div>
        <h2 className="mt-2 text-lg font-semibold text-rose-900">Prazo de pagamento encerrado</h2>
        <p className="mt-1 text-sm text-rose-800">O horário foi liberado para outros clientes. Você pode fazer um novo agendamento.</p>
      </div>
    );
  }

  const mm = Math.floor(remainingMs / 60_000);
  const ss = Math.floor((remainingMs % 60_000) / 1000);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
        <span>Aguardando pagamento…</span>
        <span className="font-mono tabular-nums">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</span>
      </div>

      {qrCodeBase64 ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR Code Pix" className="h-56 w-56 rounded-lg border border-zinc-200" />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500">
          {isMock ? "QR Code (simulado em desenvolvimento)" : "Use o código abaixo no seu app do banco"}
        </div>
      )}

      <ol className="space-y-1 text-sm text-zinc-600">
        <li>1. Abra o app do seu banco e escolha <strong>Pix → Pagar com QR Code</strong> ou <strong>Pix Copia e Cola</strong>.</li>
        <li>2. Escaneie o código ou cole o texto abaixo.</li>
        <li>3. Confirme o valor. A confirmação aparece aqui em segundos.</li>
      </ol>

      {copyPaste && (
        <div>
          <textarea readOnly value={copyPaste} rows={3} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className="btn-accent mt-2 w-full py-3 text-base"
            onClick={async () => {
              try { await navigator.clipboard.writeText(copyPaste); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* sem clipboard */ }
            }}
          >
            {copied ? "Código copiado!" : "Copiar código Pix"}
          </button>
        </div>
      )}

      {isMock && (
        <button
          type="button"
          disabled={simulating}
          className="btn-secondary w-full border-dashed"
          onClick={async () => {
            setSimulating(true);
            try {
              const r = await fetch("/api/dev/mock-pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
              if (r.ok) { setPaymentStatus("PAID"); setAppointmentStatus("CONFIRMED"); }
            } finally {
              setSimulating(false);
            }
          }}
        >
          🧪 Simular pagamento (dev)
        </button>
      )}
    </div>
  );
}
