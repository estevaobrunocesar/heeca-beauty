import { requireAuth } from "@/lib/auth/session";
import { formatPhone } from "@/lib/phone";
import { BusinessForm } from "./business-form";
import { CopyLink } from "./copy-link";

export default async function BusinessSettingsPage() {
  const { tenant } = await requireAuth();
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <BusinessForm
        initial={{
          businessName: tenant.businessName,
          ownerName: tenant.ownerName,
          slug: tenant.slug,
          description: tenant.description ?? "",
          logoUrl: tenant.logoUrl ?? "",
          phone: tenant.phone ? formatPhone(tenant.phone) : "",
          address: tenant.address ?? "",
          city: tenant.city ?? "",
          instagram: tenant.instagram ?? "",
          legalName: tenant.legalName ?? "",
          cnpj: tenant.cnpj ?? "",
          email: tenant.email ?? "",
          website: tenant.website ?? "",
          photoUrls: tenant.photoUrls.join("\n"),
          openingHours: tenant.openingHours ?? "",
          extraInfo: tenant.extraInfo ?? "",
        }}
        base={base}
      />
      <aside className="card h-fit p-5">
        <h2 className="font-medium">Seu link de agendamento</h2>
        <p className="mt-1 text-sm text-zinc-500">Coloque na bio do Instagram, no WhatsApp Business e no Google.</p>
        <CopyLink url={`${base}/agendar/${tenant.slug}`} />
      </aside>
    </div>
  );
}
