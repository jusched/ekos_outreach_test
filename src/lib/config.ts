import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

type AppConfig = {
  openAiApiKey: string | null;
  openAiModel: string;
  databaseFile: string;
  appSecret: string;
  googleClientId: string | null;
  googleClientSecret: string | null;
  googleRedirectUri: string | null;
};

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const databaseFile = resolve(
    /* turbopackIgnore: true */ process.cwd(),
    process.env.DATABASE_FILE ?? "data/app.sqlite",
  );
  mkdirSync(dirname(databaseFile), { recursive: true });

  cachedConfig = {
    openAiApiKey: process.env.OPENAI_API_KEY ?? null,
    openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    databaseFile,
    appSecret: process.env.APP_SECRET ?? "replace-me-in-env",
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? null,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? null,
    googleRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? null,
  };

  return cachedConfig;
}

export function assertWorkflowConfig() {
  const config = getAppConfig();
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required before running the workflow.");
  }

  if (!config.appSecret || config.appSecret === "replace-me-in-env") {
    throw new Error("APP_SECRET must be set before running the app.");
  }

  return config;
}

export function assertGoogleConfig() {
  const config = getAppConfig();

  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
    throw new Error(
      "Google OAuth env vars are incomplete. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI.",
    );
  }

  if (!config.appSecret || config.appSecret === "replace-me-in-env") {
    throw new Error("APP_SECRET must be set before enabling Gmail OAuth.");
  }

  return config;
}

export function getEnvironmentReadiness() {
  const config = getAppConfig();

  return {
    workflowReady: Boolean(config.openAiApiKey && config.appSecret !== "replace-me-in-env"),
    gmailReady: Boolean(
      config.googleClientId &&
        config.googleClientSecret &&
        config.googleRedirectUri &&
        config.appSecret !== "replace-me-in-env",
    ),
  };
}
