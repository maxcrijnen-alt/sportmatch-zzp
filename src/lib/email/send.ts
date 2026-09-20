/**
 * E-maillaag (voorbereid). Zonder provider-sleutel worden e-mails alleen
 * gelogd; met EMAIL_PROVIDER=resend en een RESEND_API_KEY kan dit later
 * worden geactiveerd zonder de rest van de code te wijzigen.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? "log";

  if (provider === "resend" && process.env.RESEND_API_KEY) {
    const from = process.env.EMAIL_FROM;

    if (!from) {
      throw new Error("EMAIL_FROM is verplicht wanneer EMAIL_PROVIDER=resend.");
    }

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    });
    return;
  }

  // Ontwikkel-/testmodus: alleen loggen
  console.info(`[email:${provider}] aan=${message.to} onderwerp=${message.subject}`);
}
