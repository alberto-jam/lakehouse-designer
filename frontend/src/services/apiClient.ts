import type { ArchitectureInput, ArchitectureOutput } from "./types";

const API_URL = import.meta.env.VITE_API_URL;
const TIMEOUT_MS = 30_000;

export async function generateArchitecture(
  payload: ArchitectureInput
): Promise<ArchitectureOutput> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 403) {
      throw new Error(
        "Erro de autorização. Recarregue a página e tente novamente."
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
      throw new Error("A requisição excedeu o tempo limite. Tente novamente.");
    }

    if (error instanceof TypeError) {
      throw new Error("Erro de conexão. Verifique sua rede e tente novamente.");
    }

    throw error;
  }
}
