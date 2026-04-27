import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";

export interface ResolvedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: Date;
}

let cachedCredentials: ResolvedCredentials | null = null;

/**
 * Obtém credenciais temporárias via Cognito Identity Pool.
 * As credenciais são cacheadas e renovadas automaticamente quando expiram.
 */
export async function getCredentials(): Promise<ResolvedCredentials> {
  // Reutilizar credenciais válidas em cache
  if (cachedCredentials?.expiration && cachedCredentials.expiration > new Date()) {
    return cachedCredentials;
  }

  const identityPoolId = import.meta.env.VITE_AWS_IDENTITY_POOL_ID;
  const region = import.meta.env.VITE_AWS_REGION || "us-east-1";

  if (!identityPoolId) {
    throw new Error("Identity Pool ID não configurado (VITE_AWS_IDENTITY_POOL_ID)");
  }

  const provider = fromCognitoIdentityPool({
    identityPoolId,
    clientConfig: { region },
  });

  const creds = await provider();
  cachedCredentials = {
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    sessionToken: creds.sessionToken,
    expiration: creds.expiration,
  };

  return cachedCredentials;
}

/** Verifica se as credenciais estão disponíveis (Identity Pool configurado) */
export function hasCredentials(): boolean {
  return !!import.meta.env.VITE_AWS_IDENTITY_POOL_ID;
}

/** Limpa credenciais do cache (força renovação no próximo request) */
export function clearCredentials(): void {
  cachedCredentials = null;
}
