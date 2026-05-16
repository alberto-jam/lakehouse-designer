import { AwsCredentialsInput } from "./types";

const CREDENTIALS_KEY = "lakehouse_aws_credentials";

/**
 * Retorna credenciais do localStorage ou null se não existirem ou JSON inválido.
 */
export function getCredentials(): AwsCredentialsInput | null {
  const raw = localStorage.getItem(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AwsCredentialsInput;
  } catch {
    return null;
  }
}

/**
 * Valida que os 3 campos não são vazios/whitespace, salva no localStorage.
 * Retorna true se válido e salvo, false caso contrário.
 */
export function saveCredentials(creds: AwsCredentialsInput): boolean {
  if (
    !creds.accessKeyId.trim() ||
    !creds.secretAccessKey.trim() ||
    !creds.sessionToken.trim()
  ) {
    return false;
  }
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
  return true;
}

/**
 * Remove credenciais do localStorage.
 */
export function clearCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY);
}

/**
 * Verifica se credenciais existem e não estão vazias.
 */
export function hasCredentials(): boolean {
  const creds = getCredentials();
  if (!creds) return false;
  return (
    !!creds.accessKeyId.trim() &&
    !!creds.secretAccessKey.trim() &&
    !!creds.sessionToken.trim()
  );
}
