import type { MetadataRoute } from "next";
import { marcaAtual } from "@/lib/marca-atual";
import { manifestoDaMarca } from "@/lib/pwa";

// Pela marca do host: beauty.heeca.com.br e wellness.heeca.com.br instalam cada um o seu app.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  return manifestoDaMarca(await marcaAtual());
}
