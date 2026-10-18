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
