import { useState, useEffect } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ModalCredenciais from "./components/ModalCredenciais";
import Formulario from "./components/Formulario";
import ResultadoArquitetura from "./components/ResultadoArquitetura";
import {
  getCredentials,
  saveCredentials,
  clearCredentials,
  hasCredentials,
} from "./services/credentialsService";
import { generateArchitecture } from "./services/apiClient";
import type {
  ArchitectureInput,
  ArchitectureOutput,
  AwsCredentialsInput,
} from "./services/types";
import "./App.css";

function App() {
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [result, setResult] = useState<ArchitectureOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialsMessage, setCredentialsMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!hasCredentials()) {
      setShowCredentialsModal(true);
    }
  }, []);

  async function handleSubmit(data: ArchitectureInput): Promise<void> {
    const creds = getCredentials();
    if (!creds) {
      setCredentialsMessage("Informe suas credenciais AWS para continuar.");
      setShowCredentialsModal(true);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const output = await generateArchitecture(data, creds);
      setResult(output);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      console.error("Erro técnico:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleCredentialsSave(creds: AwsCredentialsInput): void {
    saveCredentials(creds);
    setShowCredentialsModal(false);
    setCredentialsMessage(undefined);
  }

  function handleCredentialsClear(): void {
    clearCredentials();
    setCredentialsMessage(undefined);
  }

  function handleOpenCredentialsModal(): void {
    setCredentialsMessage(undefined);
    setShowCredentialsModal(true);
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onOpenCredentials={handleOpenCredentialsModal} />

      <ModalCredenciais
        isOpen={showCredentialsModal}
        onClose={() => setShowCredentialsModal(false)}
        onSave={handleCredentialsSave}
        onClear={handleCredentialsClear}
        initialValues={getCredentials()}
        message={credentialsMessage}
      />

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mx-4 mt-4 rounded">
          {error}
        </div>
      )}

      <main className="flex-1 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Parâmetros de Carga de Trabalho
            </h2>
            <Formulario onSubmit={handleSubmit} loading={loading} />
          </div>

          {result && (
            <div>
              <ResultadoArquitetura result={result} />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default App;
