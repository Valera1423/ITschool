import nodemailer from 'nodemailer';
import type { IntegrationAdapter, OutgoingMessage, SendResult, ParsedIncoming } from './types.js';
import { logger } from '../../config/logger.js';

interface EmailConfig {
  // SMTP (отправка)
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_user?: string;
  smtp_password?: string;
  from_name?: string;
  from_email?: string;

  // IMAP (приём)
  imap_host?: string;
  imap_port?: number;
  imap_secure?: boolean;
  imap_user?: string;
  imap_password?: string;
  imap_folder?: string;
}

export class EmailAdapter implements IntegrationAdapter {
  constructor(private config: EmailConfig) {}

  async send(msg: OutgoingMessage): Promise<SendResult> {
    try {
      if (!this.config.smtp_host) {
        return { ok: false, error: 'SMTP host не настроен' };
      }

      const transport = nodemailer.createTransport({
        host: this.config.smtp_host,
        port: this.config.smtp_port ?? 587,
        secure: this.config.smtp_secure ?? false,
        auth: this.config.smtp_user
          ? { user: this.config.smtp_user, pass: this.config.smtp_password ?? '' }
          : undefined,
      });

      const info = await transport.sendMail({
        from: `"${this.config.from_name ?? 'CRM'}" <${this.config.from_email ?? this.config.smtp_user}>`,
        to: msg.toName ? `"${msg.toName}" <${msg.to}>` : msg.to,
        subject: msg.subject ?? '(без темы)',
        text: msg.html ? undefined : msg.body,
        html: msg.html ? msg.body : undefined,
        attachments: msg.attachments?.map((a) => ({
          filename: a.name,
          path: a.url,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      return { ok: true, externalId: info.messageId };
    } catch (e) {
      logger.error({ err: e }, 'EmailAdapter.send failed');
      return { ok: false, error: e instanceof Error ? e.message : 'SMTP error' };
    }
  }

  async test(): Promise<{ ok: boolean; error?: string; info?: string }> {
    try {
      if (!this.config.smtp_host) return { ok: false, error: 'Не задан SMTP host' };
      const transport = nodemailer.createTransport({
        host: this.config.smtp_host,
        port: this.config.smtp_port ?? 587,
        secure: this.config.smtp_secure ?? false,
        auth: this.config.smtp_user
          ? { user: this.config.smtp_user, pass: this.config.smtp_password ?? '' }
          : undefined,
      });
      await transport.verify();
      return { ok: true, info: `SMTP ${this.config.smtp_host}:${this.config.smtp_port ?? 587} доступен` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'SMTP error' };
    }
  }
}