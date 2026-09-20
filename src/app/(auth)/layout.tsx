import Link from "next/link";
import { marcaAtual } from "@/lib/marca-atual";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const marca = await marcaAtual();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center">
          <span className="text-2xl font-semibold tracking-tight">
            {marca.nome.replace(/^Heeca /, "Heeca ")}<span className="text-brand-500">.</span>
          </span>
          <span className="mt-1 block text-xs text-zinc-500">{marca.tagline}</span>
        </Link>
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
