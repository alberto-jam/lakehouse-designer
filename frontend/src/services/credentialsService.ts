import type { AwsCredentialsInput } from "./types";

const CREDENTIALS_KEY = "lakehouse_aws_credentials";

export function getCredentials(): AwsCredentialsInput | null {
  const raw = localStorage.getItem(CREDENTIALS_KEY);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as AwsCredentialsInput;
  } catch {
    return null;
  }
}

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

export function clearCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY);
}

export function hasCredentials(): boolean {
  const raw = localStorage.getItem(CREDENTIALS_KEY);
  return raw !== null && raw.length > 0;
}
