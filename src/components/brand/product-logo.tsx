/**
 * Marca do produto dentro do sistema (logos reformulados em 12/11/2026).
 * ProductAppIcon substitui o HeecaAppIcon do kit: mesmas props, mas mostra o símbolo do logo novo.
 *
 * As imagens ficam em ./product-logos e entram no bundle por import estático (/_next/static/media),
 * então não dependem de pasta pública nem passam pelo proxy de autenticação.
 * Origem: pasta LOGOS da plataforma, mesmo recorte usado no portal (heeca_site/public/logos).
 *
 * Marca própria do cliente (logo ou tema do estabelecimento) continua com prioridade onde já tinha:
 * este componente só entra onde antes aparecia a marca Heeca.
 * Não edite brand/logo.tsx (cópia do kit compartilhado); este arquivo é do produto.
 */
import type { CSSProperties } from "react";
import type { StaticImageData } from "next/image";
import { HEECA_PRODUCTS, HeecaAppIcon, type HeecaProduct } from "./logo";
import beautyIcon from "./product-logos/beauty-icon.webp";
import wellnessIcon from "./product-logos/wellness-icon.webp";

const ICONS: Partial<Record<string, StaticImageData>> = { beauty: beautyIcon, wellness: wellnessIcon };

/**
 * Ícone quadrado do produto. `radius` segue a convenção do kit: unidades de uma caixa de 100
 * (10 = 10 % do lado). Produto sem logo novo cai no HeecaAppIcon.
 */
export function ProductAppIcon({ product, size = 48, radius = 22.5, className, style }: { product: HeecaProduct; size?: number; radius?: number; className?: string; style?: CSSProperties }) {
  const icon = ICONS[product];
  if (!icon) return <HeecaAppIcon product={product} size={size} radius={radius} className={className} style={style} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={icon.src}
      alt={HEECA_PRODUCTS[product].fullName}
      width={size}
      height={size}
      decoding="async"
      className={className}
      style={{ width: size, height: size, objectFit: "cover", background: "#fff", borderRadius: `${radius}%`, border: "1px solid rgba(21,23,26,.08)", ...style }}
    />
  );
}
