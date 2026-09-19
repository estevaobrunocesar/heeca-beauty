# Decisões de implementação

Registro cronológico. Cada entrada: contexto, decisão, alternativas descartadas, consequência.

## 2026-09-18 — Base: clone do Heeca Nail

**Contexto.** Nail e Barbearia partilham o mesmo núcleo (Tenant, Professional, Service, ProfessionalService, AvailabilityRule, ScheduleException, ScheduleBlock, Client, Appointment, WhatsappMessage, Payment) e a mesma integração com o portal. O Nail ainda tem categoria de serviço, adicionais e portfólio, que o Beauty pede.

**Decisão.** Copiar `heeca_nail` (sem histórico git) e evoluir. Banco `heeca_beauty` na porta local 5902; domínio `beauty.heeca.com.br`.

**Descartado.** Partir da Barbearia (traz `Subscription`/`SubscriptionInvoice` próprios, que o portal já substitui). Começar do zero com um pacote `@heeca/scheduling` compartilhado — desejável a prazo (SPEC §31), mas exigiria refatorar três produtos em produção antes de o Beauty existir.

**Consequência.** Vocabulário do Nail que ainda faz sentido (manicure, nail art, "a cliente") fica; o que é marca ("Heeca Nail", `NAIL_*`) foi renomeado.

## 2026-09-18 — Agendamento = visita com itens

**Contexto.** SPEC §11: "Corte (Ana) + Escova (Ana) + Manicure (Mariana)" numa mesma visita, com o motor verificando a disponibilidade de cada profissional. O `Appointment` do Nail tem um `serviceId` e `addOns[]` executados pelo mesmo profissional no mesmo bloco.

**Decisão.** `Appointment` passa a representar a **visita** (cliente, status, confirmação, pagamento, totais). Cada serviço vira um `AppointmentItem` com `professionalId`, `startsAt`, `endsAt` e snapshot de nome/duração/preço. Adicionais continuam existindo como `Service.isAddOn`, mas ligados ao item, não à visita.

**Descartado.**
- *Agendamentos encadeados por `groupId`*: menos mudança agora, mas reagendar/cancelar em bloco e execução em paralelo (manicure durante a escova) ficam manuais.
- *Um profissional por visita no MVP*: quebra o fluxo que o spec destaca.

**Consequência.** O motor de disponibilidade precisa responder "em que horários esta *sequência* de itens cabe?", não "em que horários este serviço cabe?". Comissão (§17) e ocupação (§24) passam a ser calculadas por item, o que é o desejado.
