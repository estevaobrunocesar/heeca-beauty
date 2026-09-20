import { requireAuth } from "@/lib/auth/session";
import { marcaDoTenant } from "@/lib/marca-atual";
import { escolheuSegmentos } from "@/lib/marca";
import { SegmentosForm } from "./segmentos-form";
import { SalasToggle } from "./salas-toggle";

/**
 * Segmentos do estabelecimento: o que ele faz dentro da marca (cabelo e barba, unhas, cílios…).
 * Define categorias sugeridas, ficha da cliente, exemplos e vocabulário — não é produto, é configuração.
 */
export default async function SegmentosSettingsPage() {
  const { tenant } = await requireAuth();
  const marca = marcaDoTenant(tenant);
  const escolheu = escolheuSegmentos(marca, tenant);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <SegmentosForm
        segmentos={marca.segmentos.map((s) => ({ slug: s.slug, nome: s.nome, icone: s.icone, publico: s.publico, categorias: s.categorias.map((c) => c.nome), ficha: s.ficha.map((c) => c.rotulo) }))}
        ativos={escolheu ? tenant.segmentos : []}
      />
      <div className="space-y-6 lg:col-start-1">
        <SalasToggle ativas={tenant.salasAtivas} />
      </div>
      <aside className="card h-fit p-5 lg:col-start-2 lg:row-start-1">
        <h2 className="font-medium">O que muda</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600">
          <li>• <strong>Categorias de serviço</strong>: ligar um segmento cria as categorias sugeridas dele (as que ainda não existem). Você renomeia, reordena ou exclui em Serviços.</li>
          <li>• <strong>Ficha da cliente</strong>: os campos técnicos (formato de unha, curvatura de cílios, cor de henna…) aparecem na ficha e no registro do atendimento.</li>
          <li>• <strong>Mensagens</strong>: a sugestão de retorno usa o vocabulário do segmento quando há um só.</li>
          <li>• Desligar um segmento <strong>não apaga</strong> categorias, serviços nem o que já está na ficha das clientes.</li>
        </ul>
      </aside>
    </div>
  );
}
