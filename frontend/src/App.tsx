import { useState } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Formulario from "./components/Formulario";
import ResultadoArquitetura from "./components/ResultadoArquitetura";
import { generateArchitecture } from "./services/apiClient";
import { clearCredentials } from "./services/credentialsService";
import type { ArchitectureInput, ArchitectureOutput } from "./services/types";
import "./App.css";

function App() {
  const [result, setResult] = useState<ArchitectureOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: ArchitectureInput): Promise<void> {
    setError(null);
    setLoading(true);

    try {
      const output = await generateArchitecture(data);
      setResult(output);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      console.error("Erro técnico:", err);
      // Se erro de autorização, limpar cache de credenciais para forçar renovação
      if (message.includes("autorização") || message.includes("403")) {
        clearCredentials();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />

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
