import { useState } from 'react';

export interface DiagramDownloadProps {
  contentBase64: string;
  filename: string;
}

/**
 * Decodes base64 content, creates a Blob, and triggers a browser download.
 * Returns an error message string if the content is empty or malformed, or null on success.
 */
export function downloadDrawio(contentBase64: string, filename: string): string | null {
  if (!contentBase64 || contentBase64.trim().length === 0) {
    return 'O conteúdo do diagrama está vazio. Não é possível realizar o download.';
  }

  try {
    const decodedContent = atob(contentBase64);
    const bytes = new Uint8Array(decodedContent.length);
    for (let i = 0; i < decodedContent.length; i++) {
      bytes[i] = decodedContent.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'architecture.drawio';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    return null;
  } catch {
    return 'O conteúdo do diagrama está malformado. Não é possível decodificar o arquivo.';
  }
}

export function DiagramDownload({ contentBase64, filename }: DiagramDownloadProps) {
  const [error, setError] = useState<string | null>(null);

  const handleDownload = () => {
    setError(null);
    const result = downloadDrawio(contentBase64, filename);
    if (result) {
      setError(result);
    }
  };

  const isDisabled = !contentBase64 || contentBase64.trim().length === 0;

  return (
    <div className="space-y-2">
      <button
        onClick={handleDownload}
        disabled={isDisabled}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          isDisabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }`}
        aria-label={`Download ${filename || 'diagrama .drawio'}`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        {filename ? `Baixar ${filename}` : 'Baixar Diagrama .drawio'}
      </button>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
