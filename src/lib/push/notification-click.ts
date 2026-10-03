import { notificationClickPath } from "./payload";

export type NotificationWindowClient = {
  url: string;
  focus: () => Promise<unknown>;
  navigate?: (url: string) => Promise<unknown>;
};

export type NotificationClients = {
  matchAll: (options: {
    type: "window";
    includeUncontrolled: boolean;
  }) => Promise<readonly NotificationWindowClient[]>;
  openWindow: (url: string) => Promise<unknown>;
};

export async function openNotificationDestination(
  clients: NotificationClients,
  origin: string,
  rawPath: unknown,
): Promise<"navigated" | "opened"> {
  const path = notificationClickPath(rawPath);
  const destination = new URL(path, origin).href;
  const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });

  for (const client of windows) {
    let clientOrigin = "";
    try {
      clientOrigin = new URL(client.url).origin;
    } catch {
      continue;
    }
    if (clientOrigin !== origin) {
      continue;
    }
    await client.focus();
    if (client.navigate) {
      try {
        await client.navigate(destination);
        return "navigated";
      } catch {
        break;
      }
    }
    break;
  }

  await clients.openWindow(destination);
  return "opened";
}
