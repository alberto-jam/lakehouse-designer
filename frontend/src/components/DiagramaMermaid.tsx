import { useEffect, useState, useRef } from "react";
import mermaid from "mermaid";

interface DiagramaMermaidProps {
  chart: string;
}

mermaid.initialize({ startOnLoad: false, theme: "default" });

export default function DiagramaMermaid({ chart }: DiagramaMermaidProps) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chart || !chart.trim()) {
      setError(true);
      setSvg("");
      return;
    }

    let cancelled = false;
    const id = `mermaid-${Date.now()}`;

    (async () => {
      try {
        const { svg: rendered } = await mermaid.render(id, chart);
        if (!cancelled) {
          setSvg(rendered);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setSvg("");
        }
        // mermaid.render may inject a temp element on failure — clean it up
        const temp = document.getElementById("d" + id);
        if (temp) temp.remove();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <p className="text-gray-500 italic text-sm">
        Não foi possível renderizar o diagrama.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
