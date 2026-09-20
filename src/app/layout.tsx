import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { marcaAtual } from "@/lib/marca-atual";
import { paleta } from "@/lib/marca";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Serifa elegante para os títulos da página pública (imagem premium, seção 12)
const display = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["latin"], weight: ["500", "600", "700"] });

// Metadados e paleta pela marca do host (beauty.heeca.com.br, wellness.heeca.com.br). Páginas ligadas a um
// estabelecimento (painel, página pública) reaplicam a paleta da marca do tenant num wrapper.
export async function generateMetadata(): Promise<Metadata> {
  const marca = await marcaAtual();
  return {
    title: { default: `${marca.nome} — Agendamento para ${marca.publico}`, template: `%s · ${marca.nome}` },
    description: marca.descricao,
    applicationName: marca.nome,
    icons: { icon: [{ url: `/brand/${marca.slug}/favicon.svg`, type: "image/svg+xml" }, { url: `/brand/${marca.slug}/favicon-32.png`, sizes: "32x32" }], apple: `/brand/${marca.slug}/apple-touch-icon.png` },
    openGraph: { siteName: marca.nome, locale: "pt_BR", images: [`/brand/${marca.slug}/og.png`] },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const marca = await marcaAtual();
  return (
    <html lang="pt-BR" data-marca={marca.slug} style={paleta(marca) as React.CSSProperties} className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
