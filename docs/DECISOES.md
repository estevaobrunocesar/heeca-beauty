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

## 2026-09-20 — Beauty vira o motor Heeca Schedule: marcas + segmentos (unificação)

**Contexto.** Decisão do Bruno (20/09) de consolidar o ecossistema: poucos produtos fortes por mercado, segmentos por configuração. Heeca Beauty absorve Nail, Lash, Brow, Cut e Skin; Heeca Wellness (novo) absorve Massage e Spa. Havia dois motores: `heeca_nail` (multi-marca por host, ficha e retorno inteligente por marca, mas `Appointment` de um serviço/profissional) e este (visita com itens, categorias por tenant, comissões, perfis).

**Decisão.** Este repo é o motor; o que veio do `heeca_nail` foi reescrito aqui: `src/lib/marca.ts` (marcas Beauty/Wellness com **segmentos**), `marca-atual.ts` (marca pelo host, `perfilDoTenant`, trava `mesmaMarcaDoHost`), `clients/ficha.ts` + `Client.ficha`/`Appointment.registro` (ficha por segmento, códigos `segmento.campo`), `clients/insights.ts` (retorno inteligente), `proxy.ts` (301 dos hosts absorvidos), `scripts/brand-assets.mjs`. As cinco categorias fixas do SPEC §7 viraram **categorias sugeridas por segmento** (`defaultCategories(segmentos)`); `nailShape/nailSize` viraram `unhas.formato/unhas.tamanho` na ficha. Grade de planos do Beauty passou à da família agenda (Solo 39,90 / Salão 89,90 / Salão Plus 149,90 / Rede) — "Solo" para a autônoma define a conversão do trial.

**Descartado.** Portar visita-com-itens para o `heeca_nail` (remodelar schema de cinco marcas no ar, muito maior que copiar quatro módulos puros). Um produto por nicho (116 sistemas): cada um é um container/banco/segredo/bucket a operar, sem ganho para a cliente que faz "cabelo + unhas".

**Consequência.** Nail/Lash/Brow/Cut/Skin saem da prateleira (portal: `20260920020000_unify_beauty` migra assinaturas para o Beauty e reprovisiona); os apps antigos são parados e os hosts redirecionam. Skin: só categorias e ficha básica entraram; avaliação → protocolo → plano/pacote de sessões (`heeca_skin/src/lib/treatments`) fica como módulo opcional do segmento Estética a portar (PENDENCIAS D16). Cut: fotos com bucket público e `orientacoes` nos templates ficam para o mesmo item. Wellness sobe deste repo com `MARCA_DEFAULT=wellness` (pacote de segmento do Spa em `heeca_spa/docs/SEGMENTO-SPA.md`).

## 2026-10-17 — Imagens só por upload (regra da plataforma, 28/09)

**Contexto.** Regra permanente do Bruno via Heeca_Plataform: nenhum campo de imagem pode pedir URL pública — sempre upload do arquivo do cliente, no bucket do produto. O Beauty herdou do Nail 6 campos que pediam URL (foto do profissional no cadastro e na edição, imagem do serviço, foto do portfólio, logo, fotos do espaço) e não tinha camada de storage.

**Decisão.** `src/lib/storage` (S3/R2 em produção; disco só em dev, recusado em produção) + `/api/uploads` (sharp: corrige orientação, limita o lado, WebP, remove EXIF/GPS; só JPG/PNG/WebP/GIF/HEIC/AVIF até 8 MB, SVG fora) + `ImageField`/`ImageListField` **sem campo de URL**. Chaves relativas ao produto (`<tenantId>/<tipo>/<id>.webp`); o prefixo da marca (`S3_PREFIX`) é detalhe interno do S3Storage. O guarda de verdade está no **servidor**: as actions só gravam URL do nosso storage, na pasta do próprio estabelecimento (`checkImageUrl`) — formulário forjado não passa. URL externa **já gravada** (legado do Nail/Skin) é mantida até a pessoa trocar; nunca aceita como valor novo. Arquivo trocado, removido ou de registro excluído é apagado pelo servidor depois do commit da action.

**Descartado.** (1) "Usar URL" como alternativa ao upload, como no `ImageField` da Barbearia — é exatamente o que a regra proíbe. (2) Apagar o arquivo antigo do navegador na hora da troca (padrão da Barbearia): se a pessoa abandona o formulário, o cadastro aponta para um arquivo que não existe mais. (3) Migrar em massa as URLs externas legadas para o bucket: baixar imagem de terceiro no servidor traz risco de SSRF e de conteúdo; a troca acontece quando o estabelecimento reenviar a foto.

**Consequência.** Produção exige `STORAGE_PROVIDER=s3` (`s3PublicEnv(<marca>)` no `coolify-setup.mjs` para beauty e wellness); sem isso o botão de envio falha com erro claro em vez de gravar em disco efêmero. A seed continua com fotos do Unsplash (dado de desenvolvimento, tratado como legado).

## 2026-10-17 — Módulo clínico do Skin portado como opção do segmento Estética (G5)

**Contexto.** O Skin foi absorvido pelo Beauty em 20/09, mas ficou de fora o núcleo de tratamento: protocolo → avaliação → plano/pacote de sessões → evolução. O repo `heeca_skin` tinha schema próprio (`TreatmentPlan`, `TreatmentSession`, `TreatmentPlanPayment`…).

**Decisão.** Estender o pacote de sessões que o Beauty já tinha, em vez de duplicar: o `TreatmentPlan` do Skin **é** o `ClientPackage` daqui (mesmo ciclo ACTIVE/COMPLETED/EXPIRED/CANCELLED, mesmo snapshot, saldo calculado, falta configurável). Entrou só o que o pacote não tinha: `Protocol`/`ProtocolStep` (escopo "qualquer etapa do protocolo"; a ordem é sugestão), `Assessment`/`AssessmentService` (avaliação que gera o plano), `ClientPackagePayment` (recebimentos à vista/parcelados), e `evolution`/`productsUsed` na `PackageSession`. `ClientPackage` ganhou `protocolId`, `assessmentId`, `professionalId`, `objective`, `intervalDays`; `Package` ganhou `protocolId`. Migration aditiva (`20261017120000_clinical_module`, sem DROP). Regras puras em `lib/treatments/rules.ts` (módulo ativo, próxima sessão sugerida, resumo de recebimentos, etapa sugerida) e a regra de escopo em `lib/packages/rules.ts` (preferência serviço › protocolo › categoria › livre).

**Quem vê.** O módulo aparece quando o estabelecimento atende o segmento `estetica` (ou ainda não escolheu segmento — mesma regra do resto do motor). Protocolos, recebimentos e a página do plano são de gestão; avaliações e evolução também do profissional (só as próprias; a evolução fica no detalhe do atendimento, onde ele trabalha); a recepção não vê dado clínico. Verificado com os três perfis pelas telas reais.

**Descartado.** (1) Importar as tabelas do Skin como estavam (`TreatmentPlan` paralelo ao `ClientPackage`): dois saldos para a mesma cliente. (2) Pré-criar as N sessões do plano: o saldo continua sendo calculado, nunca gravado. (3) Excluir protocolo em uso: um pacote cujo protocolo some viraria "vale tudo" — em uso só desativa. (4) Migrar dados do app antigo do Skin: não havia cliente real (confirmado em 20/09).

**Consequência.** Mudar as etapas de um protocolo vale para os planos em andamento (o que "cabe" segue o protocolo atual); sessões, validade e preço contratados são snapshot. Ficam fora, como no Skin: cobrança automática de parcelas, envio automático de retorno por template, comissão específica por protocolo.

## 2026-10-18 — WhatsApp do estabelecimento: número próprio pelo Notify, e o "mesmo número do app" (coexistência)

**Contexto.** A confirmação de agendamento precisa sair pelo número do estabelecimento, não pelo compartilhado. O Notify já tem o canal por tenant (D11: `TenantChannel` + Embedded Signup hospedado no portal, `/conta/whatsapp`) e o provider `notify` do Beauty já envia `tenantId`.

**Decisão.** O Beauty não conecta nada: consulta `GET /api/v1/channel?tenantId=` (`lib/whatsapp/channel.ts`) e a aba Configurações → WhatsApp mostra o número próprio ou "usando o número da Heeca", com o botão para o portal e a orientação de qual número usar. Quem conecta e guarda o token é o portal/Notify (o token do negócio nunca passa por aqui).

**Em aberto (Heeca_Plataform / Meta).** (1) C9/D10 bloqueiam o Embedded Signup para clientes. (2) Usar o **mesmo número** do WhatsApp Business do celular exige o modo *coexistência* da Meta: ligar no Embedded Signup do app Heeca, confirmar se o Brasil é país suportado (a pesquisa só trouxe páginas de fornecedores) e ajustar `heeca_notify/src/lib/meta-onboarding.ts`, que hoje chama `registerPhone` (número já registrado no app) e não trata a sincronização de histórico (janela de ~24 h). Limites citados: 20 msg/s, sem edição/temporárias/ver-uma-vez/listas de transmissão no app, sem selo azul. Até lá o texto da tela não promete coexistência: manda falar com a equipe antes de conectar número que já tem conversas.

## 2026-10-19 — Cor da página pública escolhida pelo estabelecimento

**Contexto.** A landing `/agendar/<slug>` usava só a cor da família da marca (rosa `#c8306f`). O estabelecimento quer a página com a cor dele.

**Decisão.** `Tenant.pageColor` (hex, null = cor da marca), escolhido em Configurações → **Aparência**: cores prontas, cor personalizada e prévia ao vivo. A cor é a base (tom 600) de toda a paleta, calculada pelo mesmo mecanismo de `paleta(marca)` (`lib/cor-pagina.ts`, `paletaDeCor`). Vale só para as páginas do cliente final (`/agendar`, `/confirmar`, `/pagar`) via `paletaDoTenant(tenant)`; o **painel segue a cor da família** (regra 3 do `CLAUDE.md`). Uma cor só, e não duas: os tons derivados já dão a variação.

**Legibilidade.** O texto sobre botões e abertura é branco, então a cor precisa de contraste mínimo 4,5:1 (WCAG AA) com branco. Cor clara demais é **ajustada ao gravar** reduzindo a luminosidade em HSL (mantém matiz e saturação; misturar com preto deixava pastéis acinzentados) e a tela avisa o que foi gravado. Cor inválida é recusada; valor ruim vindo do banco cai na cor da marca sem quebrar a página.

**Descartado.** (1) Cor também no painel: quebra o padrão Heeca e o contraste do menu. (2) Duas cores (principal e destaque): mais campos, mais combinações ilegíveis. (3) Recusar cor clara em vez de ajustar: a pessoa não sabe qual cor escolher no lugar.

**Consequência.** Migração aditiva `20261019120000_tenant_page_color` (`ALTER TABLE ... ADD COLUMN`, sem DROP).

## 2026-10-20 — Telefone da cliente opcional por estabelecimento (pedido do Studio21)

**Contexto.** A reserva exigia o WhatsApp da cliente (página pública, agendamento no painel e cadastro da cliente). O Studio21 quer aceitar reservas sem telefone.

**Decisão.** Opção do estabelecimento, `Tenant.requirePhone` (padrão `true`, então nenhum outro salão muda), em Configurações → Horários e regras. `Client.phone` passou a aceitar `null`. Com a opção desligada, vazio é aceito, mas um número digitado continua precisando ser válido (`parseClientPhone`). A regra é uma só (`createAppointment`) e vale para a página pública e para o painel.

**Efeitos de uma cliente sem telefone.** (1) Nenhuma mensagem de WhatsApp (confirmação, lembrete, cobrança): `sendAppointmentMessage` sai sem registrar nada. (2) A reserva **já nasce confirmada**: sem WhatsApp não há como confirmar, e uma pendente expiraria sozinha. (3) A tela final da reserva mostra um link `/confirmar/<token>` para ver, remarcar ou cancelar. (4) Identificação: com telefone, ele identifica a cliente (como antes); sem telefone, só o e-mail identifica; sem nenhum dos dois, cada reserva cria uma cliente nova. (5) Telas mostram "Sem telefone" e escondem os botões de WhatsApp; o link "Agendar" da lista de clientes passou a usar o id da cliente (antes era o telefone). (6) Pix: o e-mail técnico do pagador usa o id da cliente quando não há telefone nem e-mail.

**Descartado.** (1) Juntar clientes sem telefone pelo nome: misturaria duas "Maria". Quem quiser unir faz no cadastro. (2) Tornar o telefone opcional para todos: quem depende da confirmação por WhatsApp perderia o fluxo. (3) Mensagem por outro canal (e-mail): fora do escopo.

**Consequência.** Migração aditiva `20261020120000_phone_optional` (`ADD COLUMN requirePhone ... DEFAULT true` e `DROP NOT NULL` em `Client.phone`). O índice único `(tenantId, phone)` aceita vários nulos no Postgres. Studio21: o dono desmarca "Exigir o telefone da cliente ao agendar".

## 2026-10-20 — Visita com serviços ao mesmo tempo (simultânea), no painel da equipe

**Contexto.** Cliente que corta o cabelo e, na mesma hora, faz mão e cílios. A visita com itens (SPEC §11) encadeava os serviços: cada um começava quando o anterior terminava, e 5 serviços feitos por pessoas diferentes somavam o tempo de todos.

**Decisão.** Modo **simultâneo** ao lado do sequencial (`placeVisitParallel` em `scheduling/availability.ts`). Todos os serviços começam juntos, cada profissional fica ocupado só pelo tempo do próprio serviço, e a visita dura até o último terminar (corte 1h + mão 1h + cílios 1h30 = 1h30, não 3h30). Regras: (1) um profissional nunca faz dois itens ao mesmo tempo (se a visita tem dois serviços dele, o segundo vem depois do primeiro, e item com vários candidatos prefere quem está livre para começar junto); (2) sala e recurso já usados por outro item da mesma visita no mesmo intervalo não estão livres; (3) os inícios possíveis são as janelas de todos os profissionais da visita, não só os do primeiro item.

**Onde.** Só no agendamento manual do painel (Agenda → Novo agendamento, caixa "Fazer os serviços ao mesmo tempo", visível com 2+ serviços; a tela mostra o tempo estimado, ex.: "≈ 50 min no total"). A página pública continua em sequência (`/book` nunca manda `parallel`). A mesma função de horários valida a criação (`getVisitSlots(..., { parallel })`), então não há divergência entre o que a tela mostra e o que é gravado.

**Sem migração.** O modo não é gravado: ele é inferido dos itens (`visitIsParallel`: dois itens sobrepostos), e é assim que o reagendamento mantém a visita simultânea. `Appointment.durationMinutes` passa a ser o tempo total (início ao último fim) nas visitas simultâneas; preço e comissão seguem por item, sem mudança.

**Descartado.** (1) Só uma estimativa manual de tempo (um bloco para todos): bloquearia todos os profissionais pelo tempo inteiro e não saberia quem faz o quê. (2) Gravar um campo `parallel`: o dado já está nos itens, e um campo poderia divergir deles. (3) Liberar na página pública: a cliente escolheria combinações que a recepção ainda não validou; fica para uma decisão futura.

## 2026-10-21 — Acrescentar serviços a um agendamento e valores adicionais ao concluir (pedido do Studio21)

**Contexto.** A cliente marca o cabelo e, na hora, decide fazer a unha; e alguns procedimentos têm cobrança de produto usado, que a recepção precisava lançar ao concluir.

**Acrescentar serviço.** Na página do agendamento (só enquanto ele está ativo, não concluído), o cartão "Acrescentar serviço" cria mais um item da visita: profissional, serviço, adicionais e horário de início (sugeridos "agora, ao mesmo tempo" e "depois do último serviço", ajustáveis). O encaixe usa o mesmo motor da reserva (`placeAddedItems`): o profissional precisa estar livre, e sala e recursos também; os itens da própria visita não geram o intervalo entre atendimentos (só valem para outras clientes), mas o mesmo profissional nunca faz dois serviços ao mesmo tempo. Não cabendo, a tela diz o primeiro horário livre. Valor, duração (início ao último fim), fim da visita e nome do agendamento acompanham os itens; a comissão é apurada ao concluir, como sempre, e o plano de sessões da cliente é reavaliado. STAFF só acrescenta serviços do próprio profissional. Fica registrado no histórico (`ITEMS_ADDED`). Vale para todos os estabelecimentos (não é opção do Studio21).

**Valores adicionais.** Ao clicar em "Concluído" abre o diálogo "Houve valores adicionais?" (Não/Sim, com várias linhas de observação e valor). A conclusão lança os adicionais e conclui (se a conclusão falhar, os adicionais não ficam). Tabela nova `AppointmentCharge`. **Fora da comissão** (a comissão é por serviço) e **dentro do faturamento**: o painel do mês, a série do gráfico e o "total gasto" da cliente somam serviços + adicionais; o detalhe mostra "Total com adicionais". Histórico `CHARGES_ADDED`.

**Descartado.** (1) Editar/remover serviços já marcados: não foi pedido; fica como evolução. (2) Gravar os adicionais em `Appointment.priceCents`: misturaria produto com serviço e a comissão passaria a incidir sobre ele. (3) Adicionais depois de concluído: por ora só no ato de concluir. (4) Opção só do Studio21: o recurso é geral.

**Consequência.** Migração aditiva `20261021120000_appointment_charges` (cria `AppointmentCharge`). `AppointmentEvent.type` é texto livre, então os dois tipos de evento novos não pedem migração.
