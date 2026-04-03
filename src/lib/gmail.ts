export type DraftMessageInput = {
  to: string;
  subject: string;
  body: string;
};

export function buildDraftMessage({ to, subject, body }: DraftMessageInput) {
  const mime = [
    `To: ${to}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    body,
  ].join("\r\n");

  return Buffer.from(mime, "utf8").toString("base64url");
}
