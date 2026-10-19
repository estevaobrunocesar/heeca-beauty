import { requireAuth } from "@/lib/auth/session";
import { marcaDoTenant } from "@/lib/marca-atual";
import { AppearanceForm } from "./appearance-form";

export default async function AppearanceSettingsPage() {
  const { tenant } = await requireAuth();
  const marca = marcaDoTenant(tenant);
  return (
    <AppearanceForm
      initial={tenant.pageColor ?? ""}
      corDaMarca={marca.cor}
      businessName={tenant.businessName}
      link={`/agendar/${tenant.slug}`}
    />
  );
}
