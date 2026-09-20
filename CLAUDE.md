@AGENTS.md

# Heeca Schedule — motor multi-marca (Heeca Beauty, Heeca Wellness)

Este código é o motor de agenda da plataforma e serve **marcas** (produtos da prateleira) e, dentro de cada marca, **segmentos** (o que o estabelecimento faz). Leia `docs/SPEC.md` (Beauty), `docs/DECISOES.md` e `src/lib/marca.ts`.

- **Marca** = produto: `beauty` (beauty.heeca.com.br) e `wellness` (wellness.heeca.com.br). Resolvida pelo **host** na entrada (`src/lib/marca-atual.ts`: login, SSO, `/api/heeca/provision`) e gravada em `Tenant.marca`. Em produção **cada marca roda em container e Postgres próprios** (`MARCA_DEFAULT`, `infra/coolify-setup.mjs`), mesmo repo/imagem, `*_PLATFORM_SECRET` e `NOTIFY_SECRET` próprios. O código ainda assim trava: `mesmaMarcaDoHost()` em `requireAuth`, SSO e página pública — um estabelecimento nunca é servido pelo host de outra marca.
- **Segmento** = configuração do tenant (`Tenant.segmentos`, escolhido em `/app/configuracoes/segmentos`; vazio = ainda não escolheu → o painel trata como todos e pede a escolha). Cada segmento traz categorias de serviço sugeridas (viram `ServiceCategory` do tenant ao ligar; nunca são apagadas ao desligar), ficha técnica (`fichaDe`, códigos `segmento.campo`), exemplos do cadastro de serviço e a frase de retorno.
- **Hosts absorvidos** (`HOSTS_LEGADOS`): nail/lash/brow/cut/skin → beauty, massage → wellness; `src/proxy.ts` redireciona 301 para o host da marca mantendo o caminho.

Regras:
1. **Nunca escreva "Heeca Beauty", "salão", "nail designer", categoria ou campo de ficha fixos no código.** Use `marca.nome`, `marca.publico`, `perfilDoTenant(tenant)` (`marca`, `segmentos`, `ficha`), `fraseDeRetorno(segmentos)`, `categoryIcon/categoryExamples(slug)`. `Client.ficha` e `Appointment.registro` são JSON `{ "unhas.formato": valor }` lidos com `lerFicha(json, campos)`.
2. URLs públicas: `APP_URL` é o host do container desta marca; `appUrlDe(marca)` usa `APP_URL_TEMPLATE=https://{marca}.heeca.com.br` quando é preciso apontar para outra marca.
3. Paleta: Tailwind lê `--color-brand-*`; o `<html>` recebe `paleta(marcaDoHost)` e painel/página pública reaplicam `paleta(marcaDoTenant)`. A cor é a da **família** no kit de marca (beleza = `#c8306f`), não do produto.
4. Assets por marca em `public/brand/<slug>/` (`node scripts/brand-assets.mjs` copia de `../brand/dist`; marca "planned" no kit usa os do Nail como provisórios).
5. **Subir uma marca nova** = item em `MARCAS` com seus segmentos + produto/planos no seed e migração do portal (`heeca_site/scripts/catalog-sql.ts`) + em `infra/coolify-setup.mjs`: `heeca-<marca>-db`, app `heeca-<marca>` (repo heeca-beauty, `MARCA_DEFAULT`) e `PRODUCT_<SLUG>_*` com `<SLUG>_PLATFORM_SECRET` próprio + `NOTIFY_SECRET_<SLUG>` no Notify + DNS + alvo no monitor. Sem código novo.
6. **Subir um segmento novo** = item em `marca.segmentos` (pacote de segmento: categorias, ficha, exemplos, retorno) + testes em `tests/marca.test.ts`. Sem deploy separado, sem catálogo.
7. Portal: `aud` do JWT de SSO = slug da marca do host; `provision` grava `marca` a partir de `entitlement.product` e liga `segmentos` a partir de `entitlement.segment` quando vier.
8. **Opções do estabelecimento**: `salasAtivas` (agenda por sala e recursos: `Room`/`Resource`, `Service.roomRequired/rooms/resources/buffers`, `AppointmentItem.roomId`; motor em `scheduling/availability.ts` com `PlacementContext`) e pacotes de sessões (`Package`/`ClientPackage`/`PackageSession`; regras puras em `lib/packages/rules.ts`, vínculo automático em `createAppointment`, espelho em `transition`, saldo nunca gravado). Ambas valem para qualquer marca.
9. Agendamento = **visita com itens** (`Appointment` + `AppointmentItem` por serviço/profissional); comissão apurada por item ao concluir; perfis OWNER/MANAGER/RECEPTION/STAFF em `requireAuth`. Regras puras em `src/lib/**` com testes em `tests/` (`npm test`).
