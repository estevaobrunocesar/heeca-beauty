import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { marcaAtual } from "@/lib/marca-atual";
import { paleta } from "@/lib/marca";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
    <html lang="pt-BR" data-marca={marca.slug} style={paleta(marca) as React.CSSProperties} className={`${inter.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
