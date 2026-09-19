# Deploy — beauty.heeca.com.br

Mesmo caminho da Barbearia (Coolify na Hetzner, Postgres próprio, integração com o portal). Tudo é idempotente: pode rodar de novo.

## Pré-requisitos (uma vez)

1. **Repositório** `estevaobrunocesar/heeca-beauty` no GitHub, branch `main`, com o GitHub App "heeca" do Coolify instalado nele (o mesmo dos outros produtos).
2. `infra/.env` com `COOLIFY_TOKEN`, `CLOUDFLARE_API_TOKEN`/`SERVER_IP` (já existem para os demais).

## Passos

```bash
# 1. DNS: cria beauty.heeca.com.br → IP do servidor (cinza; o Traefik emite o TLS no primeiro deploy)
node infra/dns.mjs apply

# 2. Coolify: banco heeca-beauty-db + app heeca-beauty + variáveis (gera BEAUTY_* em infra/production.env)
node infra/coolify-setup.mjs plan      # confere o que vai criar
node infra/coolify-setup.mjs apply

# 3. Primeiro deploy (build do Dockerfile; migrate deploy roda no boot do container)
node infra/coolify-setup.mjs deploy heeca-beauty
node infra/coolify-setup.mjs status
```

O `apply` também grava `PRODUCT_BEAUTY_APP_URL/PROVISION_URL/SECRET` no portal. O portal sincroniza a integração no boot (`src/server/jobs/bootstrap.ts`), então **redeploy do portal** depois do passo 2:

```bash
node infra/coolify-setup.mjs deploy heeca-portal
```

## Catálogo do portal

Produto e planos entram por migração (`heeca_site/prisma/migrations/20260919050000_seed_catalog_beauty`), com `status = SOON`. Quando os preços forem confirmados, trocar para `AVAILABLE` no admin do portal (`/admin/catalogo`) — não editar a migration.

## Verificação pós-deploy

- `https://beauty.heeca.com.br/api/health` → 200.
- Log do container: `[entrypoint] prisma migrate deploy` seguido de `Ready`; **sem** `[boot] Variáveis obrigatórias ausentes`.
- `[boot] WHATSAPP_PROVIDER=console` é esperado até as credenciais Meta (`BEAUTY_WHATSAPP_*` em `infra/production.env`) existirem; com elas, `apply` liga `meta` sozinho.
- Contratar um plano de teste no portal → provision cria o salão com as 5 categorias → SSO abre o painel → `/app/servicos` lista as categorias.
- Página pública `https://beauty.heeca.com.br/agendar/<slug>`: escolher 2 serviços de profissionais diferentes e ver horários.

## O que ainda NÃO está no ar com este deploy

- Templates da Meta com o texto novo ("Serviço:" no lugar de "Procedimento:") precisam ser cadastrados — `npm run whatsapp:docs` gera o guia.
- Comissão (schema pronto, sem cálculo/tela), agendamento manual multi-serviço no painel, perfis Gerente/Recepcionista.
