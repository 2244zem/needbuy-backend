import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env, isTest } from "./env";
import { logger } from "./logger";
import type { EmailContent } from "../lib/emailTemplates";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail(to: string, content: EmailContent): Promise<boolean> {
  const transport = getTransporter();

  if (!transport) {
    if (!isTest) {
      logger.warn({ to, subject: content.subject, body: content.text }, "SMTP belum disetel, email tidak dikirim");
    }
    return false;
  }

  try {
    await transport.sendMail({
      from: { name: env.MAIL_FROM_NAME, address: env.MAIL_FROM_ADDRESS },
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return true;
  } catch (error) {
    logger.error({ err: error, to, subject: content.subject }, "gagal kirim email");
    return false;
  }
}
