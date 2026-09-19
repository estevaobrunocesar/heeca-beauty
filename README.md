# Heeca Beauty — Gestão para salões de beleza

SaaS multi-tenant que centraliza a operação de um salão: profissionais, serviços por categoria, agenda com múltiplos serviços e profissionais por visita, clientes, agendamento online com confirmação por WhatsApp, comissões e financeiro. Documento de produto em [`docs/SPEC.md`](docs/SPEC.md); decisões de implementação em [`docs/DECISOES.md`](docs/DECISOES.md).

Nasceu como um clone do **Heeca Nail** (18/09/2026): mesma stack, mesma integração com o portal (provision, entitlement, SSO), mesmo provider de WhatsApp. O que muda está na tabela abaixo.

## Stack

- **Next.js 16** (App Router, Server Actions, Route Handlers) + **React 19** + **Tailwind 4** + kit `@heeca/ui`
- **Prisma 7** + **PostgreSQL 16**
- Auth própria (JWT em cookie httpOnly, bcrypt) + SSO do portal heeca.com.br
- WhatsApp via *provider* plugável: `console` (dev) ou **Meta WhatsApp Cloud API**
- E-mail transacional: `console` (dev) ou **Resend**
- Sinal via Pix: `mock` (dev) ou **Mercado Pago**

## Rodando localmente

```bash
cp .env.example .env          # ajuste se necessário
docker compose up -d          # Postgres na porta 5902
npm install                   # roda `prisma generate` no postinstall
npx prisma migrate dev        # cria as tabelas
npm run db:seed               # salão de exemplo (logins abaixo)
npm run dev
```

- Painel: http://localhost:3000/app — `demo@heeca.app / demo1234` (responsável) · `mariana@heeca.app / mari1234` (STAFF)
- Página pública de exemplo: http://localhost:3000/agendar/salao-bela-vista
- Em dev as mensagens de WhatsApp aparecem no terminal do `npm run dev`, com o link de confirmação (`/confirmar/<token>`).

Outros comandos: `npm test`, `npm run lint`, `npm run db:studio`.

## O que muda em relação ao Nail

| Spec Beauty | Decisão | Onde |
|---|---|---|
| Categorias criadas pelo salão (§7) | `enum ServiceCategory` vira tabela `ServiceCategory` por tenant, com seed das 5 categorias padrão | `prisma/schema.prisma` |
| Vários serviços e profissionais numa visita (§11) | `Appointment` é a **visita**; cada serviço é um `AppointmentItem` com profissional, início e fim próprios | `prisma/schema.prisma` · `src/lib/scheduling` |
| Serviço → qualquer profissional (§10) | motor de horários aceita `professionalId` opcional e une os slots dos habilitados | `src/lib/scheduling/availability.ts` |
| Comissão por profissional/serviço (§17) | `Professional.commissionPct` + override em `ProfessionalService`; valor calculado por item | fase 2 |
| Caixa, pacotes, fidelidade, estoque | fora do MVP | `docs/SPEC.md` §29–30 |

## Integração com o portal Heeca

Idêntica ao Nail: `HEECA_PLATFORM_SECRET` liga provision/entitlement/SSO; com a integração ativa, `/cadastro` redireciona para `heeca.com.br/produtos/beauty`. Ver `src/lib/heeca/`.
