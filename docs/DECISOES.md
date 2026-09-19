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

## 2026-09-18 — Sequenciamento estrito, "primeiro livre", balanceamento fora do motor

**Contexto.** `placeVisit` precisa decidir como encaixar os itens de uma visita e como escolher entre profissionais candidatos.

**Decisão.** Itens estritamente em sequência (item N começa quando N-1 termina; total = soma das durações, como o "2h15" do SPEC §11). Entre os candidatos de um item, o primeiro livre na ordem da lista. O balanceamento de carga ("qualquer profissional" → quem tem menos itens no dia) fica na camada de serviço (`balanceCandidates`), que só reordena a lista antes de chamar o motor.

**Descartado.** Sobreposição entre profissionais diferentes (manicure durante a escova): encurta a visita, mas pressupõe que o salão opera assim; pode virar opção por tenant depois sem mudar a assinatura. Balanceamento dentro do motor: o tornaria dependente de dados de carga, quebrando a pureza.

**Consequência.** A mesma função pura atende dois comportamentos sem flag: lista na ordem de preferência da cliente → respeita; lista ordenada por carga → balanceia.

## 2026-09-18 — Categorias por tenant

**Decisão.** `ServiceCategory` é tabela por tenant (nome, slug, ordem). O bootstrap e o seed criam as cinco do spec; o salão renomeia, reordena, exclui e cria. Excluir categoria deixa os serviços "sem categoria" (FK `SetNull`), nunca apaga serviço. Ícones e exemplos de nomes existem só para os slugs padrão (`DEFAULT_CATEGORIES`).

## 2026-09-19 — Comissão apurada por item ao concluir a visita

**Decisão.** Regra pura em `src/lib/commissions.ts`, precedência: valor fixo do par profissional×serviço → percentual do par → percentual padrão do profissional → nada (`null`, não comissionado). Base = preço do item com adicionais; o sinal via Pix não altera a base. Arredondamento ao centavo. A apuração acontece na transição para `COMPLETED` e fica gravada em `AppointmentItem.commissionCents` (snapshot: mudar a regra depois não altera fechamentos). Sair de `COMPLETED` limpa a comissão dos itens ainda não acertados. `commissionPaidAt` marca o acerto; `/app/comissoes` fecha por mês e profissional.

**Descartado.** Calcular comissão na hora de exibir (sem snapshot): faria o histórico mudar quando o percentual muda. Tabela própria de fechamento/pagamento: desnecessária enquanto o acerto é "marcar o período como pago"; entra quando houver adiantamentos ou descontos.

## 2026-09-19 — Perfis: OWNER, MANAGER, RECEPTION, STAFF

**Decisão.** `requireAuth` expõe `role`, `isOwner` (só dono), `canManage` (dono e gerente) e `seesTeam` (dono, gerente e recepção). Gestão operacional (serviços, categorias, portfólio, equipe, configurações, comissões) usa `canManage`; acessos/perfis e configuração de pagamentos continuam `isOwner`. Recepção enxerga agenda e clientes da equipe toda, não edita cadastros nem vê comissões. Todo login continua vinculado a uma pessoa da equipe (`Professional`): quem não atende (recepção) fica inativo na agenda e não aparece na página pública.

**Descartado.** Usuários sem `Professional` (tela de acessos separada): mais uma entidade e uma tela para o MVP; o vínculo com uma pessoa da equipe cobre o caso e mantém o SSO do portal (que cria STAFF com profissional) intacto. Permissões personalizadas (§6 "futuramente") ficam para depois.

## 2026-09-19 — Beauty continua produto próprio (não vira marca do motor heeca_nail)

**Contexto.** Após a clonagem, o `heeca_nail` virou motor multi-marca ("Heeca Schedule": Nail, Lash, Tattoo, Massage, Brow no mesmo container, marca por host). A sessão do Brow propôs que o Beauty seguisse o mesmo caminho, com um pacote de port (`PORT-MOTOR.md`) para as features que o motor não tem.

**Decisão (Bruno, 19/09).** Beauty segue como produto próprio: repo, container, banco e `BEAUTY_*` próprios; `beauty.heeca.com.br`; item próprio no catálogo (slug `beauty`).

**Por quê.** O núcleo do Beauty diverge do motor no ponto central — `Appointment` é a visita com `AppointmentItem` por profissional, mais perfis Gerente/Recepção e comissão por item. Portar isso para o motor é remodelar o schema de cinco marcas em produção, não "colar código". Manter separado preserva a velocidade dos dois lados; convergência (motor ganhar visita multi-item) fica como possibilidade futura, com o Beauty servindo de referência.

**Consequência.** Corrigido o resíduo do clone que quebraria o SSO: `aud` do JWT e links do portal passam a usar `PRODUCT_SLUG = "beauty"` (`src/lib/heeca/service.ts`). Infra e catálogo preparados em 19/09 continuam valendo.
