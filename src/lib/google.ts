import { google } from "googleapis";

import { getAppDatabase } from "@/src/lib/app-database";
import { assertGoogleConfig } from "@/src/lib/config";
import { buildDraftMessage } from "@/src/lib/gmail";

export const GMAIL_DRAFT_SCOPE = "https://www.googleapis.com/auth/gmail.compose";
export const GOOGLE_STATE_COOKIE = "sales_agent_google_state";
export const GOOGLE_NEXT_COOKIE = "sales_agent_google_next";

export function createGoogleOAuthClient() {
  const config = assertGoogleConfig();

  return new google.auth.OAuth2(
    config.googleClientId!,
    config.googleClientSecret!,
    config.googleRedirectUri!,
  );
}

export function buildGoogleConsentUrl(state: string) {
  const oauthClient = createGoogleOAuthClient();

  return oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GMAIL_DRAFT_SCOPE],
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const oauthClient = createGoogleOAuthClient();
  const { tokens } = await oauthClient.getToken(code);

  oauthClient.setCredentials(tokens);

  const gmail = google.gmail({
    version: "v1",
    auth: oauthClient,
  });
  const profile = await gmail.users.getProfile({ userId: "me" });

  const email = profile.data.emailAddress;
  if (!email || !tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error("Google OAuth did not return the email or durable tokens required for Gmail drafts.");
  }

  getAppDatabase().saveGmailAccount({
    email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date,
  });

  return { email };
}

export function createPersistedGmailDraftClient() {
  const account = getAppDatabase().getGmailAccount();
  if (!account) {
    return null;
  }

  const oauthClient = createGoogleOAuthClient();
  oauthClient.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiryDate,
  });

  const gmail = google.gmail({
    version: "v1",
    auth: oauthClient,
  });

  return {
    async createDraft(input: { to: string; subject: string; body: string }) {
      const response = await gmail.users.drafts.create({
        userId: "me",
        requestBody: {
          message: {
            raw: buildDraftMessage(input),
          },
        },
      });

      if (!response.data.id) {
        throw new Error("Gmail draft creation returned no draft id.");
      }

      return {
        id: response.data.id,
        messageId: response.data.message?.id ?? undefined,
      };
    },
  };
}
