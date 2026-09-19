"use server";

import { redirect } from "next/navigation";
import { AppointmentError, cancelByToken, confirmByToken, requestRescheduleByToken } from "@/lib/appointments/service";
import { fail, type ActionResult } from "@/lib/action-result";

export async function clientConfirmAction(token: string): Promise<ActionResult> {
  try {
    await confirmByToken(token);
  } catch (e) {
    return fail(e instanceof AppointmentError ? e.message : "Erro inesperado");
  }
  redirect(`/confirmar/${token}?ok=confirmado`);
}

export async function clientRequestRescheduleAction(token: string): Promise<ActionResult> {
  try {
    await requestRescheduleByToken(token);
  } catch (e) {
    return fail(e instanceof AppointmentError ? e.message : "Erro inesperado");
  }
  redirect(`/confirmar/${token}?ok=remarcar`);
}

export async function clientCancelAction(token: string): Promise<ActionResult> {
  try {
    await cancelByToken(token);
  } catch (e) {
    return fail(e instanceof AppointmentError ? e.message : "Erro inesperado");
  }
  redirect(`/confirmar/${token}?ok=cancelado`);
}
