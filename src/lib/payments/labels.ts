import type { PaymentStatus } from "@/generated/prisma/enums";

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pago",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
  FAILED: "Falhou",
};
