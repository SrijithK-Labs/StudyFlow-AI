import React, { useMemo, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface MemoryBlock {
  ptr?: string;
  type?: string;
  value?: any;
  refcount?: number;
  points_to?: {
    type: string;
    value: any;
    refcount: number;
  };
  data_offset?: number;
  itemsize?: number;
  values?: any[];
  memory_bytes?: string;
}

interface MemorySection {
  type: string;
  description: string;
  layout: MemoryBlock[] | MemoryBlock;
}

interface MemoryLayoutData {
  [key: string]: MemorySection;
}

interface MemoryLayoutDiagramProps {
  data: string | MemoryLayoutData;
}

const MemoryLayoutDiagram: React.FC<MemoryLayoutDiagramProps> = ({ data }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const parsedData = useMemo((): MemoryLayoutData | null => {
    try {
      if (typeof data === 'string') {
        // Repair invalid JSON: quote unquoted hex values like 0x1000
        let repaired = data
          // Quote unquoted hex values: {"ptr": 0x1000} → {"ptr": "0x1000"}
          .replace(/:\s*(0x[0-9a-fA-F]+)(?=[,}\]\s])/g, ': "$1"')
          // Remove trailing commas before } or ]
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repaired);
      }
      return data;
    } catch {
      return null;
    }
  }, [data]);

  // Filter out empty sections
  const validSections = useMemo(() => {
    if (!parsedData) return [];
    return Object.entries(parsedData).filter(([, structure]) => {
      if (!structure || !structure.layout) return false;
      if (Array.isArray(structure.layout) && structure.layout.length === 0) return false;
      return true;
    });
  }, [parsedData]);

  if (validSections.length === 0) {
    return null;
  }

  return (
    <div className={`relative group w-full transition-all duration-300 ${isExpanded ? 'fixed inset-4 z-[100] bg-black/95 backdrop-blur-2xl' : ''}`}>
      <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
        >
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      <div className="glass-dark border border-white/5 rounded-2xl p-6 overflow-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
          <h3 className="text-white/90 font-bold text-sm uppercase tracking-wider">Python Memory Layout</h3>
        </div>

        <div className="space-y-8">
          {validSections.map(([name, structure]) => (
            <MemorySectionComponent key={name} name={name} structure={structure} />
          ))}
        </div>
      </div>
    </div>
  );
};

const MemorySectionComponent: React.FC<{ name: string; structure: MemorySection }> = ({ name, structure }) => {
  const isList = structure.type === 'array_of_pointers' && name.includes('list');
  const isTuple = structure.type === 'array_of_pointers' && name.includes('tuple');
  const isArray = structure.type === 'contiguous_buffer';

  return (
    <div className="bg-black/30 rounded-xl p-5 border border-white/5">
      <div className="flex items-center gap-3 mb-4">
        <span className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono text-xs font-bold">
          {name}
        </span>
        <span className="text-white/50 text-xs">{structure.type}</span>
      </div>
      <p className="text-white/60 text-sm mb-5">{structure.description}</p>

      {isArray && structure.layout && !Array.isArray(structure.layout) ? (
        <ContiguousLayout layout={structure.layout as any} />
      ) : Array.isArray(structure.layout) ? (
        <PointerLayout items={structure.layout} color={isTuple ? 'emerald' : isList ? 'indigo' : 'amber'} />
      ) : null}
    </div>
  );
};

const PointerLayout: React.FC<{ items: MemoryBlock[]; color: string }> = ({ items, color }) => {
  const colorClasses: Record<string, { bg: string; border: string; text: string; arrow: string; glow: string }> = {
    indigo: {
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/30',
      text: 'text-indigo-400',
      arrow: '#818cf8',
      glow: 'shadow-[0_0_15px_rgba(99,102,241,0.3)]',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      arrow: '#34d399',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      arrow: '#fbbf24',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    },
  };

  const c = colorClasses[color] || colorClasses.indigo;

  return (
    <div className="space-y-4">
      {/* Pointer Array Container */}
      <div className={`relative ${c.bg} ${c.border} border rounded-xl p-4`}>
        <div className="absolute -top-2.5 left-4 px-2 bg-black/60 text-[10px] font-bold uppercase tracking-widest text-white/40">
          Pointer Array (PyObject*)
        </div>
        <div className="flex gap-3 mt-2 overflow-x-auto pb-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2 min-w-[100px]">
              <span className="text-[10px] font-mono text-white/30">{item.ptr}</span>
              <div className={`w-16 h-16 rounded-lg ${c.bg} border ${c.border} ${c.glow} flex flex-col items-center justify-center`}>
                <span className={`text-[10px] font-mono ${c.text}`}>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PyObject Blocks */}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map((item, idx) => {
          const target = item.points_to;
          if (!target) return null;
          return (
            <div key={idx} className="flex flex-col items-center gap-2">
              <div className="bg-black/40 border border-white/10 rounded-xl p-4 min-w-[140px]">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${c.bg.replace('/10', '/60')}`} />
                  <span className="text-white/70 font-mono text-xs font-bold">PyObject</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white/40 text-[10px] uppercase tracking-wider">type</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-white/80 font-mono text-xs">{target.type}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/40 text-[10px] uppercase tracking-wider">value</span>
                    <span className={`px-2 py-0.5 rounded ${c.bg} ${c.text} font-mono text-xs font-bold`}>{String(target.value)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/40 text-[10px] uppercase tracking-wider">refcnt</span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-white/60 font-mono text-xs">{target.refcount}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Arrow SVG */}
      <svg className="w-full h-8" viewBox={`0 0 ${items.length * 120} 30`} fill="none">
        {items.map((_, idx) => {
          const x = idx * 120 + 50;
          return (
            <g key={idx}>
              <line x1={x} y1={0} x2={x} y2={30} stroke={c.arrow} strokeWidth={2} strokeDasharray="4 4">
                <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
              </line>
              <polygon points={`${x - 4},24 ${x + 4},24 ${x},30`} fill={c.arrow} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const ContiguousLayout: React.FC<{ layout: MemoryBlock }> = ({ layout }) => {
  const values = layout.values || [];
  const memoryBytes = layout.memory_bytes || '';
  const bytePairs = memoryBytes ? memoryBytes.split(' ') : [];
  const itemsize = layout.itemsize || 8;

  return (
    <div className="space-y-4">
      {/* Memory Grid */}
      <div className="bg-black/40 border border-amber-500/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-amber-400 font-mono text-xs font-bold">Contiguous Memory Block</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-white/5 rounded-lg p-3">
            <span className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Offset</span>
            <span className="text-amber-400 font-mono text-sm">{layout.data_offset}</span>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <span className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Item Size</span>
            <span className="text-amber-400 font-mono text-sm">{itemsize} bytes</span>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <span className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Total</span>
            <span className="text-amber-400 font-mono text-sm">{values.length * itemsize} bytes</span>
          </div>
        </div>

        {/* Value Blocks */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {values.map((val, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2 min-w-[100px]">
              <span className="text-[10px] font-mono text-white/30">offset {idx * itemsize}</span>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 min-w-[80px] text-center shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <span className="text-amber-400 font-mono text-lg font-bold">{val}</span>
              </div>
              <span className="text-[10px] font-mono text-white/40">int64</span>
            </div>
          ))}
        </div>
      </div>

      {/* Raw Bytes */}
      {bytePairs.length > 0 && (
        <div className="bg-black/40 border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-white/50 font-mono text-[10px] uppercase tracking-wider">Raw Bytes (Little-Endian)</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {bytePairs.map((byte, idx) => (
              <span
                key={idx}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  idx % itemsize === 0
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-white/5 text-white/40'
                }`}
              >
                {byte}
              </span>
            ))}
          </div>
          <p className="text-white/30 text-[10px] mt-3 font-mono">
            Each {itemsize}-byte group = one int64 value (little-endian byte order)
          </p>
        </div>
      )}
    </div>
  );
};

export default MemoryLayoutDiagram;
