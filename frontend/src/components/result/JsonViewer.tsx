import React, { useState, useCallback, useMemo } from 'react';

export interface JsonViewerProps {
  data: unknown;
  title?: string;
}

interface JsonNodeProps {
  keyName?: string;
  value: unknown;
  depth: number;
  isLast: boolean;
}

function JsonNode({ keyName, value, depth, isLast }: JsonNodeProps) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  const indent = '  '.repeat(depth);
  const childIndent = '  '.repeat(depth + 1);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isCollapsible = isObject || isArray;

  const comma = isLast ? '' : ',';

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  // Render primitive values with syntax highlighting
  if (!isCollapsible) {
    const rendered = renderPrimitive(value);
    return (
      <div className="leading-6">
        <span className="text-slate-500 select-none">{indent}</span>
        {keyName !== undefined && (
          <>
            <span className="text-purple-700">&quot;{keyName}&quot;</span>
            <span className="text-slate-600">: </span>
          </>
        )}
        {rendered}
        <span className="text-slate-600">{comma}</span>
      </div>
    );
  }

  const entries = isArray ? value : Object.entries(value as Record<string, unknown>);
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';
  const itemCount = isArray ? value.length : Object.keys(value as object).length;

  // Empty object/array
  if (itemCount === 0) {
    return (
      <div className="leading-6">
        <span className="text-slate-500 select-none">{indent}</span>
        {keyName !== undefined && (
          <>
            <span className="text-purple-700">&quot;{keyName}&quot;</span>
            <span className="text-slate-600">: </span>
          </>
        )}
        <span className="text-slate-600">
          {openBracket}{closeBracket}{comma}
        </span>
      </div>
    );
  }

  return (
    <div>
      {/* Opening line with toggle */}
      <div className="leading-6 group">
        <span className="text-slate-500 select-none">{indent}</span>
        {keyName !== undefined && (
          <>
            <span className="text-purple-700">&quot;{keyName}&quot;</span>
            <span className="text-slate-600">: </span>
          </>
        )}
        <button
          type="button"
          onClick={toggleCollapse}
          className="inline-flex items-center gap-0.5 hover:bg-slate-200 rounded px-0.5 -mx-0.5 transition-colors"
          aria-label={collapsed ? 'Expandir seção' : 'Recolher seção'}
          aria-expanded={!collapsed}
        >
          <span className="text-slate-400 text-xs w-3 text-center select-none">
            {collapsed ? '▶' : '▼'}
          </span>
          <span className="text-slate-600">{openBracket}</span>
        </button>
        {collapsed && (
          <>
            <span className="text-slate-400 text-xs ml-1">
              {itemCount} {itemCount === 1 ? 'item' : 'itens'}
            </span>
            <span className="text-slate-600">{closeBracket}{comma}</span>
          </>
        )}
      </div>

      {/* Children */}
      {!collapsed && (
        <>
          {isArray
            ? (entries as unknown[]).map((item, index) => (
                <JsonNode
                  key={index}
                  value={item}
                  depth={depth + 1}
                  isLast={index === itemCount - 1}
                />
              ))
            : (entries as [string, unknown][]).map(([key, val], index) => (
                <JsonNode
                  key={key}
                  keyName={key}
                  value={val}
                  depth={depth + 1}
                  isLast={index === itemCount - 1}
                />
              ))}
          {/* Closing bracket */}
          <div className="leading-6">
            <span className="text-slate-500 select-none">{childIndent.slice(2)}</span>
            <span className="text-slate-600">{closeBracket}{comma}</span>
          </div>
        </>
      )}
    </div>
  );
}

function renderPrimitive(value: unknown): React.ReactNode {
  if (value === null) {
    return <span className="text-orange-600 italic">null</span>;
  }
  if (typeof value === 'boolean') {
    return <span className="text-blue-700 font-medium">{value ? 'true' : 'false'}</span>;
  }
  if (typeof value === 'number') {
    return <span className="text-green-700">{value}</span>;
  }
  if (typeof value === 'string') {
    return <span className="text-amber-700">&quot;{value}&quot;</span>;
  }
  return <span className="text-slate-600">{String(value)}</span>;
}

export function JsonViewer({ data, title }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);

  const jsonString = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return '// Erro ao serializar JSON';
    }
  }, [data]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = jsonString;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [jsonString]);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header with title and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-sm font-medium text-slate-700">
          {title || 'JSON'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 active:bg-slate-200 transition-colors"
          aria-label="Copiar JSON"
        >
          {copied ? (
            <>
              <svg
                className="w-3.5 h-3.5 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-600">Copiado!</span>
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copiar JSON</span>
            </>
          )}
        </button>
      </div>

      {/* JSON content with horizontal scroll */}
      <div
        className="overflow-x-auto bg-white p-4 font-mono text-xs"
        data-testid="json-viewer-content"
      >
        <div className="whitespace-pre min-w-fit">
          <JsonNode value={data} depth={0} isLast={true} />
        </div>
      </div>
    </div>
  );
}
