import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-js";
import type { ArchitectureInput, ArchitectureOutput, AwsCredentialsInput } from "./types";

const API_URL = import.meta.env.VITE_API_URL;
const AWS_REGION = import.meta.env.VITE_AWS_REGION;
const TIMEOUT_MS = 30_000;

export async function generateArchitecture(
  payload: ArchitectureInput,
  credentials: AwsCredentialsInput
): Promise<ArchitectureOutput> {
  const signer = new SignatureV4({
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
    service: "execute-api",
    region: AWS_REGION,
    sha256: Sha256,
  });

  const url = new URL(API_URL);

  const request = new HttpRequest({
    method: "POST",
    protocol: url.protocol,
    hostname: url.hostname,
    path: url.pathname,
    headers: {
      "Content-Type": "application/json",
      host: url.hostname,
    },
    body: JSON.stringify(payload),
  });

  const signedRequest = await signer.sign(request);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${url.protocol}//${url.hostname}${url.pathname}`,
      {
        method: signedRequest.method,
        headers: signedRequest.headers as Record<string, string>,
        body: signedRequest.body,
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (response.status === 403) {
      throw new Error(
        "Erro de autorização. Suas credenciais podem ter expirado ou ser inválidas. Clique em 'Alterar Credenciais' para informar novas credenciais."
      );
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro HTTP ${response.status}: ${text}`);
    }

    return (await response.json()) as ArchitectureOutput;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "A requisição excedeu o tempo limite. Tente novamente."
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Erro de conexão. Verifique sua rede e tente novamente."
      );
    }

    throw error;
  }
}
