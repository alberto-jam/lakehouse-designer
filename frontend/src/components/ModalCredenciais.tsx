import { useState, useEffect } from "react";
import type { AwsCredentialsInput } from "../services/types";

interface ModalCredenciaisProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (credentials: AwsCredentialsInput) => void;
  onClear: () => void;
  initialValues?: AwsCredentialsInput | null;
  message?: string;
}

export default function ModalCredenciais({
  isOpen,
  onClose,
  onSave,
  onClear,
  initialValues,
  message,
}: ModalCredenciaisProps) {
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (initialValues) {
      setAccessKeyId(initialValues.accessKeyId || "");
      setSecretAccessKey(initialValues.secretAccessKey || "");
      setSessionToken(initialValues.sessionToken || "");
    } else {
      setAccessKeyId("");
      setSecretAccessKey("");
      setSessionToken("");
    }
    setValidationError("");
  }, [initialValues, isOpen]);

  function handleConfirm() {
    if (
      !accessKeyId.trim() ||
      !secretAccessKey.trim() ||
      !sessionToken.trim()
    ) {
      setValidationError("Todos os três campos são obrigatórios.");
      return;
    }
    setValidationError("");
    onSave({ accessKeyId, secretAccessKey, sessionToken });
  }

  function handleClear() {
    setAccessKeyId("");
    setSecretAccessKey("");
    setSessionToken("");
    setValidationError("");
    onClear();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Credenciais AWS
        </h2>

        {message && (
          <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-2 mb-4">
            {message}
          </p>
        )}

        {validationError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-4">
            {validationError}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="accessKeyId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Access Key ID
            </label>
            <input
              id="accessKeyId"
              type="text"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="AKIAIOSFODNN7EXAMPLE"
            />
          </div>

          <div>
            <label
              htmlFor="secretAccessKey"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Secret Access Key
            </label>
            <input
              id="secretAccessKey"
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
            />
          </div>

          <div>
            <label
              htmlFor="sessionToken"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Session Token
            </label>
            <textarea
              id="sessionToken"
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              placeholder="FwoGZXIvYXdzEBYaDH..."
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-6">
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium text-sm"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 bg-red-100 text-red-700 px-4 py-2 rounded hover:bg-red-200 font-medium text-sm"
          >
            Limpar Credenciais
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 font-medium text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
