export type PreservedAuthFields = {
  display_name?: string;
  email?: string;
};

export function preservedFieldsOnSignUpValidationError(input: {
  email: string;
  password: string;
  displayName: string;
}): PreservedAuthFields | undefined {
  if (input.password.length >= 8) {
    return undefined;
  }
  return {
    display_name: input.displayName,
    email: input.email.trim(),
  };
}

export function preservedFieldsOnSignInValidationError(input: {
  email: string;
  password: string;
}): PreservedAuthFields | undefined {
  if (input.email.trim() && input.password) {
    return undefined;
  }
  if (input.email.trim()) {
    return { email: input.email.trim() };
  }
  return undefined;
}
