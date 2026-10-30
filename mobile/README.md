# Heeca Beauty — app Android e iOS (profissionais)

O app é o painel `https://beauty.heeca.com.br/app` dentro de um app nativo ([Capacitor](https://capacitorjs.com)).
Telas e regras ficam no servidor: **corrigir o painel não exige publicar de novo nas lojas**. O nativo traz ícone,
tela de abertura e **avisos no celular** (novo agendamento e cancelamento pela cliente).

- Usa o mesmo login do painel. Cada pessoa vê o que o perfil dela permite (profissional, recepção, gerente, dona).
- O `User-Agent` do app termina em `HeecaApp`; o painel reconhece o app pelo `window.Capacitor`
  (`src/components/dashboard/native-shell.tsx`), que pede permissão, registra o aparelho em
  `POST /api/mobile/push-token` e abre a agenda do dia ao tocar no aviso.
- Servidor: `src/lib/push/*` (regras, cliente do Firebase Cloud Messaging, envio). Sem `FCM_SERVICE_ACCOUNT_JSON`
  os avisos ficam desligados e o resto funciona.

## O que é preciso ter (por conta da Heeca)

| Item | Para quê | Custo |
|---|---|---|
| Conta **Google Play Console** | publicar no Android | US$ 25, uma vez |
| Conta **Apple Developer Program** | publicar no iPhone (App Store/TestFlight) | US$ 99 por ano |
| Projeto **Firebase** (grátis) | enviar os avisos para Android e iPhone | grátis |
| Um **Mac com Xcode** | compilar e enviar o app de iPhone | — |
| **Android Studio** (JDK 17) | compilar o Android (roda no Windows) | — |

## Firebase (avisos)

1. Crie um projeto em <https://console.firebase.google.com>.
2. Adicione um app **Android** com o pacote `br.com.heeca.beauty` e baixe o `google-services.json` para
   `mobile/android/app/google-services.json` (está no `.gitignore`).
3. Adicione um app **iOS** com o bundle `br.com.heeca.beauty`, baixe o `GoogleService-Info.plist` para
   `mobile/ios/App/App/` e, em *Configurações → Cloud Messaging*, envie a **chave APNs** (.p8) da conta Apple.
4. *Configurações → Contas de serviço → Gerar nova chave privada*. O JSON inteiro vai na variável de ambiente
   `FCM_SERVICE_ACCOUNT_JSON` do container do Beauty (Coolify). Nada de commitar esse arquivo.
5. Migração do banco: `prisma migrate deploy` (cria `DeviceToken`).

## Gerar e testar

```bash
cd mobile
npm install
npm run assets     # ícones e tela de abertura a partir de assets/*.svg (kit de marca)
npx cap sync       # copia a configuração para android/ e ios/
npm run android    # abre o Android Studio (Run ▶ no emulador ou aparelho)
npm run ios        # só no Mac: abre o Xcode
```

Para apontar o app para outro ambiente: `HEECA_APP_URL=https://staging.exemplo.com npx cap sync`.

### iOS: passos que só o Xcode faz (uma vez)

1. Em *Signing & Capabilities* escolha o time da Apple e ligue **Push Notifications** e **Background Modes → Remote notifications**.
2. Para o aparelho entregar o token do Firebase (e não o do APNs), siga *Capacitor → Push Notifications → iOS → Firebase*:
   `pod 'FirebaseMessaging'` no `ios/App/Podfile` (`pod install`), `FirebaseApp.configure()` no `AppDelegate`
   e o repasse do token do APNs ao `Messaging`. Sem isso o iPhone abre o app normalmente, mas não recebe aviso.

## Publicar

- **Android:** `android/` → *Build → Generate Signed Bundle (AAB)* com uma chave de assinatura (guarde-a fora do repositório) e envie ao Play Console.
- **iOS:** *Product → Archive → Distribute App* → TestFlight primeiro, depois a revisão da App Store.
- Nome: **Heeca Beauty**. Pacote/bundle: `br.com.heeca.beauty`. Texto de loja: "Agenda e clientes para profissionais de beleza".
- A App Store (diretriz 4.2) pode recusar app que seja só um site. O que sustenta o app é o uso nativo: avisos no
  celular, ícone e tela própria, login persistente. Na descrição, destaque isso.
- **Revisão da loja** exige uma conta de teste: crie um estabelecimento de demonstração e informe e-mail e senha na ficha de revisão.
