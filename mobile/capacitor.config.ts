import type { CapacitorConfig } from "@capacitor/cli";

/**
 * O app é o painel do site (beauty.heeca.com.br/app) dentro de um app nativo: telas e regras vivem no servidor,
 * então uma correção no painel chega ao app sem publicar nas lojas. O nativo entrega o que o site sozinho não
 * entrega: ícone próprio, tela de abertura e avisos no celular (novo agendamento, cancelamento).
 * Para apontar para outro ambiente (staging): HEECA_APP_URL=https://staging.exemplo.com npx cap sync
 */
const base = process.env.HEECA_APP_URL ?? "https://beauty.heeca.com.br";
const host = new URL(base).host;

const config: CapacitorConfig = {
  appId: "br.com.heeca.beauty",
  appName: "Heeca Beauty",
  webDir: "www", // só a tela "sem conexão"; o conteúdo real vem de server.url
  server: {
    url: `${base}/app`,
    cleartext: false,
    allowNavigation: [host, `*.${host}`], // o painel e o login ficam dentro do app; links externos abrem no navegador
  },
  appendUserAgent: "HeecaApp",
  backgroundColor: "#f4f4f5",
  android: { allowMixedContent: false },
  ios: { contentInset: "automatic" },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#c8306f", showSpinner: false },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
