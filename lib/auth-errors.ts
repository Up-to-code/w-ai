const AUTH_ERROR_KEYS = {
  INVALID_EMAIL_OR_PASSWORD: "errorInvalidEmailOrPassword",
  INVALID_EMAIL_OR_PASSWORD_CODE: "errorInvalidEmailOrPassword",
  USER_NOT_FOUND: "errorInvalidEmailOrPassword",
  INVALID_PASSWORD: "errorInvalidEmailOrPassword",
  USER_ALREADY_EXISTS: "errorUserAlreadyExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "errorUserAlreadyExists",
  INVALID_EMAIL: "errorInvalidEmail",
  PASSWORD_TOO_SHORT: "errorPasswordTooShort",
  PASSWORD_TOO_LONG: "errorPasswordTooLong",
  WEAK_PASSWORD: "errorPasswordTooShort",
  EMAIL_NOT_VERIFIED: "errorEmailNotVerified",
  TOO_MANY_REQUESTS: "errorTooManyRequests",
  FAILED_TO_CREATE_USER: "errorGeneric",
  FAILED_TO_CREATE_SESSION: "errorGeneric",
} as const;

export type AuthKey =
  | (typeof AUTH_ERROR_KEYS)[keyof typeof AUTH_ERROR_KEYS]
  | "errorGeneric"
  | "errorNetwork"
  | "errorNameRequired"
  | "errorPasswordRequired"
  | "errorEmailRequired";

export function authErrorKey(code?: string | null, message?: string | null): AuthKey {
  if (code && code in AUTH_ERROR_KEYS) {
    return AUTH_ERROR_KEYS[code as keyof typeof AUTH_ERROR_KEYS];
  }

  const hay = `${code ?? ""} ${message ?? ""}`.toLowerCase();
  if (hay.includes("already exists") || hay.includes("user_already")) {
    return "errorUserAlreadyExists";
  }
  if (hay.includes("invalid email") || hay.includes("email_invalid")) {
    return "errorInvalidEmail";
  }
  if (hay.includes("password") && hay.includes("short")) {
    return "errorPasswordTooShort";
  }
  if (
    hay.includes("invalid") &&
    (hay.includes("password") || hay.includes("credential") || hay.includes("email"))
  ) {
    return "errorInvalidEmailOrPassword";
  }
  if (hay.includes("network") || hay.includes("fetch")) {
    return "errorNetwork";
  }
  return "errorGeneric";
}

export function validateAuthFields(input: {
  email?: string;
  password?: string;
  name?: string;
  mode: "login" | "register";
}): AuthKey | null {
  const email = input.email?.trim() ?? "";
  const password = input.password ?? "";
  const name = input.name?.trim() ?? "";

  if (!email) return "errorEmailRequired";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "errorInvalidEmail";
  if (!password) return "errorPasswordRequired";
  if (password.length < 8) return "errorPasswordTooShort";
  if (input.mode === "register" && name.length < 2) return "errorNameRequired";
  return null;
}
