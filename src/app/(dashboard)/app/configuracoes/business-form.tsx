"use client";

import { useActionState } from "react";
import { updateBusinessAction } from "@/actions/settings";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";

type Values = {
  businessName: string; ownerName: string; slug: string; description: string;
  logoUrl: string; phone: string; address: string; city: string; instagram: string;
  legalName: string; cnpj: string; email: string; website: string; photoUrls: string; openingHours: string; extraInfo: string; metaMensal: string;
};

export function BusinessForm({ initial, base }: { initial: Values; base: string }) {
  const [state, action] = useActionState(updateBusinessAction, null);
  return (
    <form action={action} className="card space-y-4 p-6">
      {state?.ok && <Alert kind="success">{state.message}</Alert>}
      {state && !state.ok && <Alert>{state.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="businessName">Nome comercial</label>
          <input id="businessName" name="businessName" required className="input" defaultValue={initial.businessName} />
        </div>
        <div>
          <label className="label" htmlFor="ownerName">Nome do responsável</label>
          <input id="ownerName" name="ownerName" required className="input" defaultValue={initial.ownerName} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="legalName">Razão social <span className="font-normal text-zinc-400">(opcional)</span></label>
          <input id="legalName" name="legalName" className="input" defaultValue={initial.legalName} placeholder="Bela Vista Cabeleireiros Ltda." />
        </div>
        <div>
          <label className="label" htmlFor="cnpj">CNPJ <span className="font-normal text-zinc-400">(opcional)</span></label>
          <input id="cnpj" name="cnpj" inputMode="numeric" className="input" defaultValue={initial.cnpj} placeholder="00.000.000/0001-00" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="slug">Link personalizado</label>
        <div className="flex items-center overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
          <span className="hidden shrink-0 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 sm:block">{base.replace(/^https?:\/\//, "")}/agendar/</span>
          <input id="slug" name="slug" required className="w-full px-3 py-2 text-sm focus:outline-none" defaultValue={initial.slug} />
        </div>
        <p className="mt-1 text-xs text-zinc-500">Apenas letras, números e hífens.</p>
      </div>

      <div>
        <label className="label" htmlFor="description">Descrição do espaço</label>
        <textarea id="description" name="description" rows={3} className="input" defaultValue={initial.description} placeholder="Studio especializado em alongamento em fibra e esmaltação em gel. Atendimento individual, com hora marcada." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="phone">Telefone / WhatsApp</label>
          <input id="phone" name="phone" inputMode="tel" className="input" defaultValue={initial.phone} placeholder="(11) 99999-8888" />
        </div>
        <div>
          <label className="label" htmlFor="logoUrl">URL da foto / logotipo</label>
          <input id="logoUrl" name="logoUrl" type="url" className="input" defaultValue={initial.logoUrl} placeholder="https://..." />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="instagram">Instagram</label>
        <div className="flex items-center overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
          <span className="shrink-0 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">@</span>
          <input id="instagram" name="instagram" className="w-full px-3 py-2 text-sm focus:outline-none" defaultValue={initial.instagram} placeholder="salaobelavista" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">E-mail do salão</label>
          <input id="email" name="email" type="email" className="input" defaultValue={initial.email} placeholder="contato@seusalao.com.br" />
        </div>
        <div>
          <label className="label" htmlFor="website">Site</label>
          <input id="website" name="website" type="url" className="input" defaultValue={initial.website} placeholder="https://seusalao.com.br" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div>
          <label className="label" htmlFor="address">Endereço</label>
          <input id="address" name="address" className="input" defaultValue={initial.address} placeholder="Rua das Flores, 123 - Centro" />
        </div>
        <div>
          <label className="label" htmlFor="city">Cidade</label>
          <input id="city" name="city" className="input" defaultValue={initial.city} placeholder="São Paulo - SP" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="openingHours">Horário de funcionamento <span className="font-normal text-zinc-400">(texto da página pública)</span></label>
        <input id="openingHours" name="openingHours" className="input" defaultValue={initial.openingHours} placeholder="Ter–Sex 9h às 19h · Sáb 8h às 15h" />
        <p className="mt-1 text-xs text-zinc-500">Só informativo. Os horários que geram vagas são os de cada profissional, em Equipe.</p>
      </div>

      <div>
        <label className="label" htmlFor="photoUrls">Fotos do espaço <span className="font-normal text-zinc-400">(uma URL por linha, até 12)</span></label>
        <textarea id="photoUrls" name="photoUrls" rows={3} className="input font-mono text-xs" defaultValue={initial.photoUrls} placeholder={"https://...\nhttps://..."} />
      </div>

      <div>
        <label className="label" htmlFor="extraInfo">Informações adicionais</label>
        <textarea id="extraInfo" name="extraInfo" rows={2} className="input" defaultValue={initial.extraInfo} placeholder="Estacionamento no local, acessível para cadeirantes, aceitamos cartão e Pix." />
      </div>

      <div>
        <label className="label" htmlFor="metaMensal">Meta de faturamento do mês (R$) <span className="font-normal text-zinc-400">(opcional)</span></label>
        <input id="metaMensal" name="metaMensal" inputMode="decimal" className="input max-w-xs" defaultValue={initial.metaMensal} placeholder="6.000,00" />
        <p className="mt-1 text-xs text-zinc-500">Aparece como anel de progresso no painel inicial.</p>
      </div>

      <div className="pt-2">
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </form>
  );
}
