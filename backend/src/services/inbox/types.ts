export interface OutgoingMessage {
  to: string;
  toName?: string;
  subject?: string;
  body: string;
  attachments?: { name: string; url?: string; content?: string; contentType?: string }[];
  html?: boolean;
}

export interface SendResult {
  ok: boolean;
  externalId?: string;
  error?: string;
}

export interface IntegrationAdapter {
  send(msg: OutgoingMessage): Promise<SendResult>;
  test(): Promise<{ ok: boolean; error?: string; info?: string }>;

  /**
   * Обработать входящий webhook.
   * rawBody передаётся для проверки подписи (Meta, Telegram и др.).
   */
  handleWebhook?(
    body: unknown,
    headers: Record<string, string>,
    rawBody?: Buffer,
  ): Promise<{
    messages: ParsedIncoming[];
    ok: boolean;
  }>;
}

export interface ParsedIncoming {
  externalId?: string;
  threadId?: string;
  fromAddress: string;
  fromName?: string;
  toAddress?: string;
  subject?: string;
  body: string;
  attachments?: { name: string; url: string }[];
  raw?: Record<string, unknown>;
  receivedAt?: Date;
}