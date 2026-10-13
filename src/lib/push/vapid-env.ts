export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function readVapidConfig(env: Record<string, string | undefined>): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) {
    return null;
  }
  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    return null;
  }
  return { publicKey, privateKey, subject };
}
