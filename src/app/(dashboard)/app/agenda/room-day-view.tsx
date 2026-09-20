import Link from "next/link";
import { fmtTime } from "@/lib/dates";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AppointmentStatus } from "@/generated/prisma/enums";

export type RoomColumn = {
  id: string;
  name: string;
  kind: string | null;
  blocks: { id: string; startsAt: Date; endsAt: Date; reason: string | null }[];
  items: { id: string; appointmentId: string; startsAt: Date; endsAt: Date; bufferBeforeMinutes: number; bufferAfterMinutes: number; serviceName: string; clientName: string; professionalName: string; status: AppointmentStatus }[];
};

/**
 * Agenda por sala (opção salasAtivas): uma coluna por sala ativa, com os itens do dia de todos os
 * profissionais e os bloqueios de manutenção. Preparo/limpeza aparecem como faixa cinza.
 */
export function RoomDayView({ rooms, tz, semSala }: { rooms: RoomColumn[]; tz: string; semSala: number }) {
  if (rooms.length === 0) {
    return <div className="card px-6 py-10 text-center text-sm text-zinc-500">Nenhuma sala ativa. <Link href="/app/salas" className="underline">Cadastre suas salas</Link>.</div>;
  }
  return (
    <div className="space-y-3">
      {semSala > 0 && <p className="text-xs text-zinc-500">{semSala} {semSala === 1 ? "atendimento do dia não usa sala" : "atendimentos do dia não usam sala"} (aparecem só na visão por profissional).</p>}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(rooms.length, 4)}, minmax(0, 1fr))` }}>
        {rooms.map((room) => {
          const linhas = [
            ...room.items.map((it) => ({ key: it.id, at: it.startsAt, node: (
              <Link href={`/app/agendamentos/${it.appointmentId}`} className="block rounded-lg border border-zinc-200 bg-white p-2.5 text-sm hover:border-brand-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular-nums text-zinc-500">{fmtTime(it.startsAt, tz)}–{fmtTime(it.endsAt, tz)}</span>
                  <StatusBadge status={it.status} className="text-[10px]" />
                </div>
                <div className="mt-1 font-medium text-zinc-800">{it.serviceName}</div>
                <div className="text-xs text-zinc-500">{it.clientName} · {it.professionalName}</div>
                {(it.bufferBeforeMinutes > 0 || it.bufferAfterMinutes > 0) && (
                  <div className="mt-1 text-[11px] text-zinc-400">{it.bufferBeforeMinutes > 0 ? `preparo ${it.bufferBeforeMinutes} min` : ""}{it.bufferBeforeMinutes > 0 && it.bufferAfterMinutes > 0 ? " · " : ""}{it.bufferAfterMinutes > 0 ? `limpeza ${it.bufferAfterMinutes} min` : ""}</div>
                )}
              </Link>
            ) })),
            ...room.blocks.map((b) => ({ key: b.id, at: b.startsAt, node: (
              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-2.5 text-sm text-zinc-600">
                <span className="tabular-nums">{fmtTime(b.startsAt, tz)}–{fmtTime(b.endsAt, tz)}</span> · Bloqueada{b.reason ? ` · ${b.reason}` : ""}
              </div>
            ) })),
          ].sort((a, b) => a.at.getTime() - b.at.getTime());
          return (
            <section key={room.id} className="card p-3">
              <h2 className="mb-2 font-medium">{room.name}{room.kind && <span className="ml-2 text-xs font-normal text-zinc-500">{room.kind}</span>}</h2>
              <div className="space-y-2">
                {linhas.length === 0 && <p className="py-4 text-center text-xs text-zinc-400">Livre o dia todo</p>}
                {linhas.map((l) => <div key={l.key}>{l.node}</div>)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
