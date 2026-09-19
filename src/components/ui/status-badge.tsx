import type { AppointmentStatus } from "@/generated/prisma/enums";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/appointments/status";

export function StatusBadge({ status, className = "" }: { status: AppointmentStatus; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]} ${className}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
