export const AUTH_ACTION_TIMEOUT_MS = 20_000;

export class AuthActionTimeoutError extends Error {
  constructor() {
    super("AUTH_TIMEOUT");
    this.name = "AuthActionTimeoutError";
  }
}

export async function withAuthActionTimeout<T>(work: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AuthActionTimeoutError()), AUTH_ACTION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function authTimeoutUserMessage(): string {
  return "Sign-in is taking too long. Check your connection and try again.";
}
