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
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && initialValues) {
      setAccessKeyId(initialValues.accessKeyId);
      setSecretAccessKey(initialValues.secretAccessKey);
      setSessionToken(initialValues.sessionToken);
    } else if (isOpen) {
      setAccessKeyId("");
      setSecretAccessKey("");
      setSessionToken("");
    }
    setErrors({});
  }, [isOpen, initialValues]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const newErrors: Record<string, string> = {};
    if (!accessKeyId.trim()) newErrors.accessKeyId = "Campo obrigatório";
    if (!secretAccessKey.trim()) newErrors.secretAccessKey = "Campo obrigatório";
    if (!sessionToken.trim()) newErrors.sessionToken = "Campo obrigatório";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({ accessKeyId, secretAccessKey, sessionToken });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">Credenciais AWS</h2>

        {message && (
          <p className="text-sm text-blue-700 bg-blue-50 rounded p-2 mb-4">
            {message}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access Key ID
            </label>
            <input
              type="text"
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.accessKeyId && (
              <p className="text-red-600 text-xs mt-1">{errors.accessKeyId}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secret Access Key
            </label>
            <input
              type="text"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.secretAccessKey && (
              <p className="text-red-600 text-xs mt-1">{errors.secretAccessKey}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session Token
            </label>
            <input
              type="text"
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.sessionToken && (
              <p className="text-red-600 text-xs mt-1">{errors.sessionToken}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-6 justify-end">
          <button
            onClick={onClear}
            className="text-sm text-red-600 hover:text-red-800 px-3 py-1.5 rounded border border-red-300 hover:bg-red-50 transition-colors"
          >
            Limpar Credenciais
          </button>
          <button
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="text-sm text-white bg-indigo-700 hover:bg-indigo-600 px-4 py-1.5 rounded transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
