import { RuleSetConfig } from "./config";

/** [{SLOT_LABEL} UPDATE] {Staff first name} — {note}{" — " + link if provided} */
export function buildWhatsAppMessage(slotLabel: string, staffFirstName: string, note: string, link?: string | null) {
  const base = `[${slotLabel} UPDATE] ${staffFirstName} — ${note}`;
  return link ? `${base} — ${link}` : base;
}

export function buildWhatsAppUrl(
  config: Pick<RuleSetConfig, "whatsappMode" | "adminWhatsappNumber">,
  message: string
): string {
  const text = encodeURIComponent(message);
  if (config.whatsappMode === "DIRECT" && config.adminWhatsappNumber) {
    return `https://wa.me/${config.adminWhatsappNumber}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}
