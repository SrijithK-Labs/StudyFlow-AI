import { useEffect, useState, useRef } from "react";
import { Maximize2, Minimize2, ExternalLink, Brush } from "lucide-react";

interface D2DiagramProps {
    code: string;
    theme?: number;
    sketch?: boolean;
}

export default function D2Diagram({ code, theme = 0, sketch = false }: D2DiagramProps) {
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSketch, setIsSketch] = useState(sketch);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;

        const renderD2 = async () => {
            try {
                // Dynamically import to ensure it only runs on the client side
                const { D2 } = await import("@terrastruct/d2");
                const d2Instance = new D2();

                const compiled = await d2Instance.compile(code, {
                    themeID: theme,
                    sketch: isSketch,
                    pad: 20
                } as any);

                const rendered = await d2Instance.render(compiled.diagram, {
                    themeID: theme,
                    sketch: isSketch,
                } as any);

                if (isMounted) {
                    setSvgContent((rendered as any).svg || rendered);
                    setError(null);
                }
            } catch (err: any) {
                if (isMounted) {
                    console.error("D2 Parsing Error:", err);
                    setError(err.message || "Failed to render D2 diagram.");
                    setSvgContent(null);
                }
            }
        };

        renderD2();

        return () => {
            isMounted = false;
        };
    }, [code, theme, isSketch]);

    return (
        <div className={`relative group w-full flex flex-col items-center glass-dark border border-white/5 rounded-2xl p-6 transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-[100] bg-black/90 backdrop-blur-xl' : 'min-h-[200px] max-h-[700px] overflow-auto custom-scrollbar'}`} ref={containerRef}>
            {/* Header / Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                    onClick={() => setIsSketch(!isSketch)}
                    className={`p-2 rounded-lg transition-colors ${isSketch ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-transparent'}`}
                    title="Toggle Sketch Mode"
                >
                    <Brush size={16} />
                </button>
                <a
                    href={`https://play.d2lang.com/?script=${encodeURIComponent(code)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                    title="Open in D2 Playground"
                >
                    <ExternalLink size={16} />
                </a>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                    {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
            </div>

            {/* Rendering Area */}
            {error ? (
                <div className="w-full mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 font-mono text-sm whitespace-pre-wrap">{error}</p>
                    <div className="mt-4 p-4 bg-black/50 rounded-lg">
                        <p className="text-white/50 text-xs mb-2">Original Code:</p>
                        <pre className="text-white/70 text-xs overflow-auto">{code}</pre>
                    </div>
                </div>
            ) : svgContent ? (
                <div
                    className="w-full h-full flex justify-center items-center overflow-auto custom-scrollbar min-w-0"
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                />
            ) : (
                <div className="flex flex-col items-center justify-center h-40 text-white/50">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <p className="text-sm">Rendering D2 Diagram...</p>
                </div>
            )}
        </div>
    );
}
