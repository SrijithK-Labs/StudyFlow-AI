import React, { useCallback, useEffect, useState } from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    Background,
    Controls,
    Connection,
    Edge,
    MarkerType,
    Panel,
    BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { Maximize2, Minimize2, RefreshCcw } from 'lucide-react';

const elk = new ELK();

interface DiagramJSON {
    type: string;
    direction?: 'LR' | 'TD';
    nodes: Array<{ id: string; label: string; type?: string }>;
    edges: Array<{ source: string; target: string; label?: string; animated?: boolean }>;
}

interface PremiumDiagramProps {
    data: string | DiagramJSON;
}

const elkOptions = {
    'elk.algorithm': 'layered',
    'elk.layered.spacing.nodeNodeLayered': '80',
    'elk.spacing.nodeNode': '80',
};

const getLayoutedElements = async (nodes: any[], edges: any[], type = 'flowchart', direction = 'TD') => {
    const isHorizontal = direction === 'LR';
    const algorithm = type === 'mindmap' ? 'mrtree' : 'layered';

    const graph = {
        id: 'root',
        layoutOptions: {
            'elk.algorithm': algorithm,
            'elk.direction': isHorizontal ? 'RIGHT' : 'DOWN',
            'elk.padding': '[top=50,left=50,bottom=50,right=50]',
            'elk.spacing.nodeNode': '80',
            ...(algorithm === 'layered' ? {
                'elk.layered.spacing.nodeNodeLayered': '100',
                'elk.layered.nodePlacement.strategy': 'SIMPLE',
            } : {}),
        },
        children: nodes.map((node) => ({
            ...node,
            width: 250,
            height: 100,
        })),
        edges: edges.map((edge) => ({
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target],
        })),
    };

    const layoutedGraph = await elk.layout(graph);

    return {
        nodes: nodes.map((node) => {
            const layoutedNode = layoutedGraph.children?.find((n) => n.id === node.id);
            return {
                ...node,
                position: {
                    x: layoutedNode?.x || 0,
                    y: layoutedNode?.y || 0,
                },
            };
        }),
        edges,
    };
};

/**
 * Attempts to repair malformed JSON strings common in AI outputs.
 * Handles trailing commas, unclosed brackets/braces, and truncated strings.
 */
function repairJson(json: string): string {
    let repaired = json.trim();

    // 1. Remove markdown backticks if they were included inside the string
    repaired = repaired.replace(/```json-diagram/g, "").replace(/```/g, "");

    // 2. Handle mid-property or mid-value truncation
    // Find the last completely closed object or array element
    const lastClosingBrace = repaired.lastIndexOf('}');
    const lastClosingBracket = repaired.lastIndexOf(']');

    // We want the last closing brace that belongs to an object in an array
    // OR the last closing bracket if it's the end of an array.
    // Heuristic: SNIP after the last '}' that is followed by a ',' or is the last '}'.
    const lastValidObjectEnd = repaired.lastIndexOf('}');

    if (lastValidObjectEnd !== -1) {
        // Look for the last '}' that is NOT followed by something that looks like more data 
        // (except for array/object close)
        repaired = repaired.substring(0, lastValidObjectEnd + 1);
    }

    // 3. Remove trailing commas (very common when cut off)
    repaired = repaired.replace(/,\s*$/g, '');
    repaired = repaired.replace(/,\s*([\]}])/g, '$1');

    // 4. Force balance braces and brackets
    const count = (str: string, char: string) => (str.match(new RegExp('\\' + char, 'g')) || []).length;

    let openBraces = count(repaired, '{');
    let closeBraces = count(repaired, '}');
    let openBrackets = count(repaired, '[');
    let closeBrackets = count(repaired, ']');

    // If we have an open string, close it
    if ((repaired.match(/"/g) || []).length % 2 !== 0) {
        repaired += '"';
    }

    // Close arrays first (since nodes/edges are arrays)
    while (openBrackets > closeBrackets) {
        repaired += ']';
        closeBrackets++;
    }
    // Then close objects
    while (openBraces > closeBraces) {
        repaired += '}';
        closeBraces++;
    }

    return repaired;
}

import { Handle, Position } from '@xyflow/react';

const PremiumNode = ({ data }: any) => {
    return (
        <div className={`premium-node-wrapper premium-node-${data.type || 'default'}`}>
            <Handle type="target" position={Position.Top} className="premium-handle" />
            <div className="premium-node-content">
                <div className="premium-node-type-indicator" />
                <span className="premium-node-label">{data.label}</span>
            </div>
            <Handle type="source" position={Position.Bottom} className="premium-handle" />
        </div>
    );
};

const nodeTypes = {
    default: PremiumNode,
    input: PremiumNode,
    output: PremiumNode,
    process: PremiumNode,
    choice: PremiumNode,
    note: PremiumNode,
    actor: PremiumNode,
};

const PremiumDiagram: React.FC<PremiumDiagramProps> = ({ data }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const reactFlowInstance = React.useRef<any>(null);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds: any) => addEdge(params, eds)),
        [setEdges]
    );

    const lastDataRef = React.useRef<string | null>(null);

    useEffect(() => {
        const initDiagram = async () => {
            const dataString = typeof data === 'string' ? data : JSON.stringify(data);
            if (dataString === lastDataRef.current) return;
            lastDataRef.current = dataString;

            try {
                let parsedData: DiagramJSON;
                if (typeof data === 'string') {
                    const repaired = repairJson(data);
                    parsedData = JSON.parse(repaired);
                } else {
                    parsedData = data;
                }

                // ── Normalize alternative key names from different AI models ──
                const raw = parsedData as any;

                // Unwrap nested `data` object (e.g. { data: { blocks: [...], connections: [...] } })
                if (raw.data && typeof raw.data === 'object') {
                    if (!raw.nodes && (raw.data.nodes || raw.data.blocks || raw.data.items || raw.data.elements)) {
                        raw.nodes = raw.data.nodes || raw.data.blocks || raw.data.items || raw.data.elements;
                    }
                    if (!raw.edges && (raw.data.edges || raw.data.connections || raw.data.links || raw.data.arrows)) {
                        raw.edges = raw.data.edges || raw.data.connections || raw.data.links || raw.data.arrows;
                    }
                }

                if (!raw.nodes && raw.blocks) raw.nodes = raw.blocks;
                if (!raw.nodes && raw.items) raw.nodes = raw.items;
                if (!raw.nodes && raw.elements) raw.nodes = raw.elements;
                if (!raw.edges && raw.connections) raw.edges = raw.connections;
                if (!raw.edges && raw.links) raw.edges = raw.links;
                if (!raw.edges && raw.arrows) raw.edges = raw.arrows;
                if (!raw.edges && raw.connections) raw.edges = raw.connections;
                if (!raw.edges && raw.links) raw.edges = raw.links;
                if (!raw.edges && raw.arrows) raw.edges = raw.arrows;

                // Normalize edge keys: from/to → source/target
                if (raw.edges) {
                    raw.edges = raw.edges.map((e: any) => ({
                        ...e,
                        source: e.source || e.from,
                        target: e.target || e.to,
                    }));
                }

                // Self-healing: auto-inject any referenced node ids in edges that are missing from raw.nodes
                if (!raw.nodes) raw.nodes = [];
                if (raw.edges) {
                    const nodeIds = new Set(raw.nodes.map((n: any) => n ? String(n.id) : ""));
                    raw.edges.forEach((e: any) => {
                        const srcId = e.source ? String(e.source) : "";
                        const tgtId = e.target ? String(e.target) : "";
                        [srcId, tgtId].forEach((id) => {
                            if (id && !nodeIds.has(id)) {
                                nodeIds.add(id);
                                let label = id;
                                let nodeType = "default";
                                if (raw[id] !== undefined) {
                                    if (typeof raw[id] === 'object' && raw[id] !== null) {
                                        label = raw[id].label || raw[id].name || id;
                                        nodeType = raw[id].type || "default";
                                    } else {
                                        label = String(raw[id]);
                                    }
                                }
                                raw.nodes.push({ id, label, type: nodeType });
                            }
                        });
                    });
                }

                parsedData = raw as DiagramJSON;

                if (!parsedData.nodes || parsedData.nodes.length === 0) {
                    setError("Diagram has no nodes to render.");
                    return;
                }

                const initialNodes = (parsedData.nodes || []).map((n: any) => {
                    // Extract label from various possible locations
                    let label = n.label || n.title || n.text || n.name || n.description;
                    
                    // Check nested data object
                    if (!label && n.data) {
                        if (typeof n.data === 'string') {
                            label = n.data;
                        } else if (typeof n.data === 'object') {
                            label = n.data.label || n.data.title || n.data.text || n.data.name;
                        }
                    }
                    
                    // Check nested properties object
                    if (!label && n.properties) {
                        label = n.properties.label || n.properties.title || n.properties.name;
                    }
                    
                    // Final fallback to id
                    if (!label) {
                        label = String(n.id || 'Node');
                    }
                    
                    return {
                        id: String(n.id),
                        data: {
                            label,
                            type: n.type || 'default'
                        },
                        position: { x: 0, y: 0 },
                        type: n.type || 'default',
                    };
                });

                const initialEdges = (parsedData.edges || []).map((e: any, i: number) => ({
                    id: `e${i}`,
                    source: String(e.source),
                    target: String(e.target),
                    label: e.label,
                    animated: e.animated ?? true,
                    style: { stroke: '#818cf8', strokeWidth: 2, filter: 'drop-shadow(0 0 5px rgba(129, 140, 248, 0.5))' },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#818cf8',
                    },
                }));

                const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
                    initialNodes,
                    initialEdges,
                    parsedData.type || 'flowchart',
                    parsedData.direction || 'TD'
                );

                setNodes(layoutedNodes);
                setEdges(layoutedEdges);
                setError(null);

                // Force fitView after layout with a delay to let ReactFlow render
                setTimeout(() => {
                    if (reactFlowInstance.current) {
                        reactFlowInstance.current.fitView({ padding: 0.2, maxZoom: 1 });
                    }
                }, 100);
            } catch (err: any) {
                console.error("[PremiumDiagram] Parse Error:", err.message || err);
                setError("Failed to parse diagram data.");
            }
        };

        initDiagram();
    }, [data, setNodes, setEdges]);

    if (error) {
        return (
            <div className="w-full p-6 glass-dark border border-red-500/20 rounded-2xl flex flex-col gap-4">
                <div className="text-red-400 font-bold flex items-center gap-2">
                    <span>⚠️ Diagram Error</span>
                </div>
                <pre className="text-xs text-white/50 bg-black/20 p-4 rounded-lg overflow-auto max-h-40">
                    {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
                </pre>
            </div>
        );
    }

    return (
        <div className={`premium-diagram-container relative group transition-all duration-700 ${isExpanded ? 'fixed inset-4 z-[100] bg-black/95 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl' : 'w-full h-[400px] md:h-[500px] glass-dark border border-white/5 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl'}`}>
            <div className="absolute top-6 right-6 flex items-center gap-3 z-50 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/10 shadow-lg backdrop-blur-xl"
                >
                    {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={(instance: any) => { reactFlowInstance.current = instance; }}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ maxZoom: 1 }}
                colorMode="dark"
                className="premium-flow"
                minZoom={0.2}
                maxZoom={2}
            >
                <Background color="#333" gap={24} size={1.5} variant={BackgroundVariant.Dots} />
                <Controls showInteractive={false} className="glass m-6 border-white/10 rounded-2xl overflow-hidden" />
                <Panel position="top-left" className="m-6">
                    <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-bold uppercase tracking-widest text-indigo-400 backdrop-blur-2xl flex items-center gap-2 shadow-xl">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1] animate-pulse" />
                        Premium Interactive Graph
                    </div>
                </Panel>
            </ReactFlow>

            <style jsx global>{`
        .premium-node-wrapper {
          min-width: 140px;
          max-width: 280px;
          padding: 2px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.01));
          transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
          cursor: pointer;
        }

        .premium-node-content {
          background: rgba(10, 10, 15, 0.85);
          backdrop-filter: blur(20px);
          padding: 16px 20px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid rgba(255,255,255,0.05);
          position: relative;
          overflow: hidden;
        }

        .premium-node-type-indicator {
          width: 4px;
          height: 24px;
          border-radius: 2px;
          background: #6366f1;
          flex-shrink: 0;
        }

        .premium-node-input .premium-node-type-indicator { background: #10b981; box-shadow: 0 0 10px #10b981; }
        .premium-node-output .premium-node-type-indicator { background: #f43f5e; box-shadow: 0 0 10px #f43f5e; }
        .premium-node-process .premium-node-type-indicator { background: #8b5cf6; box-shadow: 0 0 10px #8b5cf6; }
        .premium-node-default .premium-node-type-indicator { background: #6366f1; box-shadow: 0 0 10px #6366f1; }
        .premium-node-choice .premium-node-type-indicator { background: #f59e0b; box-shadow: 0 0 10px #f59e0b; }
        .premium-node-note .premium-node-type-indicator { background: #94a3b8; box-shadow: 0 0 10px #94a3b8; }
        .premium-node-actor .premium-node-type-indicator { background: #06b6d4; box-shadow: 0 0 10px #06b6d4; }

        .premium-node-label {
          color: #f1f5f9;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
          word-break: break-word;
        }

        .premium-node-wrapper:hover {
          transform: translateY(-4px) scale(1.02);
          background: linear-gradient(135deg, rgba(99,102,241,0.5), rgba(99,102,241,0.1));
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.6);
        }

        .premium-handle {
          width: 8px !important;
          height: 8px !important;
          background: #6366f1 !important;
          border: 2px solid #000 !important;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .premium-node-wrapper:hover .premium-handle {
          opacity: 1;
        }

        .react-flow__edge-path {
          stroke-dasharray: 4;
          animation: flow 30s linear infinite;
        }

        @keyframes flow {
          from { stroke-dashoffset: 100; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
        </div>
    );
};
export default PremiumDiagram;
