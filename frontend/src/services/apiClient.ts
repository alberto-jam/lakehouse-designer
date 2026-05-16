import type { ArchitectureInput, ArchitectureOutput } from "./types";
import type {
  GenerateV2Request,
  GenerateV2Response,
  ValidationErrorResponse,
} from "./typesV2";
import { clearCredentials } from "./credentialsService";

// =============================================================================
// V1 Configuration
// =============================================================================

const API_URL = import.meta.env.VITE_API_URL;
const TIMEOUT_MS = 30_000;

// =============================================================================
// V2 Configuration
// =============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const TIMEOUT_V2_MS = 60_000; // 60s for V2 (more complex generation)

// =============================================================================
// Custom Error Classes
// =============================================================================

/** Thrown when VITE_API_BASE_URL is not configured in the environment. */
export class ApiConfigError extends Error {
  constructor() {
    super("VITE_API_BASE_URL is not configured. Check your .env file.");
    this.name = "ApiConfigError";
  }
}

/** Thrown when the backend returns HTTP 422 with structured validation errors. */
export class ValidationApiError extends Error {
  public fields: Array<{ path: string; message: string; code: string }>;

  constructor(response: ValidationErrorResponse) {
    super(response.message);
    this.name = "ValidationApiError";
    this.fields = response.fields;
  }
}

/** Thrown when the backend returns HTTP 403 (authorization failure). */
export class AuthError extends Error {
  constructor(message?: string) {
    super(
      message || "Erro de autorização. Recarregue a página e tente novamente."
    );
    this.name = "AuthError";
  }
}

/** Thrown when the request exceeds the configured timeout. */
export class TimeoutError extends Error {
  constructor() {
    super("A requisição excedeu o tempo limite (60s). Tente novamente.");
    this.name = "TimeoutError";
  }
}

/** Thrown when a network connectivity error occurs. */
export class NetworkError extends Error {
  constructor() {
    super("Erro de conexão. Verifique sua rede e tente novamente.");
    this.name = "NetworkError";
  }
}

// =============================================================================
// V1 API Function (existing, unchanged)
// =============================================================================

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

// =============================================================================
// V2 API Function
// =============================================================================

/**
 * Calls the POST /generate-v2 endpoint with the full wizard payload.
 *
 * Error handling:
 * - Throws ApiConfigError when VITE_API_BASE_URL is undefined
 * - Throws ValidationApiError on HTTP 422 with field-level errors
 * - Throws AuthError on HTTP 403 and clears stored credentials
 * - Throws TimeoutError when the request exceeds 60s
 * - Throws NetworkError on connectivity failures
 */
export async function generateV2(
  payload: GenerateV2Request
): Promise<GenerateV2Response> {
  if (!API_BASE_URL) {
    throw new ApiConfigError();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_V2_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/generate-v2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 422) {
      const errorBody = (await response.json()) as ValidationErrorResponse;
      throw new ValidationApiError(errorBody);
    }

    if (response.status === 403) {
      clearCredentials();
      throw new AuthError();
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro HTTP ${response.status}: ${text}`);
    }

    return (await response.json()) as GenerateV2Response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (
      error instanceof ApiConfigError ||
      error instanceof ValidationApiError ||
      error instanceof AuthError
    ) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TimeoutError();
    }

    if (error instanceof TypeError) {
      throw new NetworkError();
    }

    throw error;
  }
}
