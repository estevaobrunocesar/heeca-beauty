import Link from "next/link";
import { marcaAtual } from "@/lib/marca-atual";
import { HEECA_PRODUCTS, HeecaAppIcon, type HeecaProduct } from "@/components/brand/logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const marca = await marcaAtual();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex flex-col items-center text-center">
          <HeecaAppIcon product={(marca.slug in HEECA_PRODUCTS ? marca.slug : "heeca") as HeecaProduct} size={56} radius={14} className="mb-3" />
          <span className="text-2xl font-bold tracking-[-0.03em]">Heeca <span className="font-medium text-brand-600">{marca.nome.replace(/^Heeca /, "")}</span></span>
          <span className="mt-1 block text-xs text-mut">{marca.tagline}</span>
        </Link>
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
