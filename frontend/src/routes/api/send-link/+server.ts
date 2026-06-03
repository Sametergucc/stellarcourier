import { json, error } from "@sveltejs/kit";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } from "$env/static/private";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const { to, receiveUrl, channel } = (await request.json()) as {
    to:         string;
    receiveUrl: string;
    channel:    "sms" | "whatsapp";
  };

  if (!to || !receiveUrl)          throw error(400, "Missing to or receiveUrl");
  if (!TWILIO_ACCOUNT_SID)         throw error(500, "TWILIO_ACCOUNT_SID not set");
  if (!TWILIO_AUTH_TOKEN)          throw error(500, "TWILIO_AUTH_TOKEN not set");
  if (!TWILIO_FROM_NUMBER)         throw error(500, "TWILIO_FROM_NUMBER not set");

  const from = channel === "whatsapp" ? `whatsapp:${TWILIO_FROM_NUMBER}` : TWILIO_FROM_NUMBER;
  const dest = channel === "whatsapp" ? `whatsapp:${to}`                 : to;
  const body = `📦 StellarCourier — Teslim linkin:\n${receiveUrl}\n\nKuryeye bu ekranı göster, QR'ı okutacak.`;

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: dest, Body: body }),
    },
  );

  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}));
    throw error(502, (e as any).message ?? "Twilio error");
  }

  const msg = await resp.json();
  return json({ sid: msg.sid, status: msg.status });
};
