export type PasswordRuleState = {
  minLength: boolean;
  matches: boolean;
};

export function evaluatePasswordRules(
  password: string,
  confirmPassword: string,
): PasswordRuleState {
  return {
    minLength: password.length >= 8,
    matches: password.length > 0 && password === confirmPassword,
  };
}

export function passwordsMeetRules(password: string, confirmPassword: string): boolean {
  const rules = evaluatePasswordRules(password, confirmPassword);
  return rules.minLength && rules.matches;
}
