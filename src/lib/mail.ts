import nodemailer from 'nodemailer';
import { config } from './config';

let transport: ReturnType<typeof nodemailer.createTransport> | undefined;

/** Sends a plain-text mail over SMTP. Without SMTP_URL the mail is logged instead, so the shop works in development. */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!config.smtpUrl) {
    console.log(`[mail not sent: SMTP_URL is not set]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  transport ??= nodemailer.createTransport(config.smtpUrl);
  await transport.sendMail({ from: config.mailFrom, to, subject, text });
}
