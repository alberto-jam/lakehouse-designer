// Credenciais não são mais necessárias no frontend.
// A API Gateway está configurada sem autenticação IAM.
// A segurança é garantida pelo CloudFront (acesso restrito) e rede corporativa.

export function hasCredentials(): boolean {
  return true;
}

export function clearCredentials(): void {
  // no-op
}
