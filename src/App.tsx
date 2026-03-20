import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Copy, 
  Check, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  FileJson, 
  Zap,
  AlertCircle,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { extractJson, ExtractedJson } from './utils/jsonExtractor';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const JsonNode: React.FC<{ data: any; label?: string; depth?: number; highlightText?: string }> = ({ data, label, depth = 0, highlightText }) => {
  const isObject = typeof data === 'object' && data !== null;
  const isArray = Array.isArray(data);
  
  // Check if this node or its children match the highlight text
  const matches = useMemo(() => {
    if (!highlightText) return false;
    const stringData = String(data);
    return stringData.includes(highlightText) || (label && label.includes(highlightText));
  }, [data, label, highlightText]);

  const hasMatchingChild = useMemo(() => {
    if (!highlightText || !isObject) return false;
    const str = JSON.stringify(data);
    return str.includes(highlightText);
  }, [data, highlightText, isObject]);

  const [isOpen, setIsOpen] = useState(depth < 2);

  // Auto-expand if a child matches
  useEffect(() => {
    if (hasMatchingChild) {
      setIsOpen(true);
    }
  }, [hasMatchingChild]);
  
  const toggle = () => setIsOpen(!isOpen);

  if (!isObject) {
    return (
      <div className={cn(
        "flex items-start gap-2 py-0.5 font-mono text-sm transition-colors rounded px-1 -ml-1",
        matches && highlightText ? "bg-emerald-500/20 text-emerald-200" : ""
      )}>
        {label && <span className={cn(
          "font-medium",
          matches && label?.includes(highlightText) ? "text-emerald-300 underline underline-offset-2" : "text-zinc-500"
        )}>{label}:</span>}
        <span className={cn(
          typeof data === 'string' ? "text-emerald-500/80" : 
          typeof data === 'number' ? "text-amber-500/80" : 
          typeof data === 'boolean' ? "text-indigo-500/80" : "text-zinc-500",
          matches && String(data).includes(highlightText) && "text-emerald-300 font-bold"
        )}>
          {typeof data === 'string' ? `"${data}"` : String(data)}
        </span>
      </div>
    );
  }

  const keys = isArray ? data : Object.keys(data);
  const isEmpty = keys.length === 0;

  return (
    <div className="font-mono text-sm">
      <div 
        className="flex items-center gap-1 py-0.5 cursor-pointer hover:bg-zinc-800/50 rounded px-1 -ml-1 transition-colors"
        onClick={toggle}
      >
        {!isEmpty && (
          isOpen ? <ChevronDown size={14} className="text-zinc-600" /> : <ChevronRight size={14} className="text-zinc-600" />
        )}
        {isEmpty && <div className="w-3.5" />}
        {label && <span className="text-zinc-400 font-medium">{label}:</span>}
        <span className="text-zinc-600">
          {isArray ? `Array[${data.length}]` : `Object{${Object.keys(data).length}}`}
        </span>
      </div>
      
      {isOpen && !isEmpty && (
        <div className="pl-4 border-l border-zinc-800 ml-1.5 mt-0.5 space-y-0.5">
          {isArray ? (
            data.map((item, i) => <JsonNode key={i} data={item} label={String(i)} depth={depth + 1} highlightText={highlightText} />)
          ) : (
            Object.entries(data).map(([key, value]) => <JsonNode key={key} data={value} label={key} depth={depth + 1} highlightText={highlightText} />)
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [input, setInput] = useState('');
  const [extracted, setExtracted] = useState<ExtractedJson[]>([]);
  const [parseTime, setParseTime] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 });
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const start = performance.now();
    const results = extractJson(input);
    const end = performance.now();
    setExtracted(results);
    setParseTime(end - start);
  }, [input]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  const clearInput = () => setInput('');

  useEffect(() => {
    if (!searchTerm) {
      if (!selectedText) setActiveBlockIndex(null);
      return;
    }

    const index = extracted.findIndex(item => JSON.stringify(item.parsed).toLowerCase().includes(searchTerm.toLowerCase()));
    if (index !== -1) {
      setActiveBlockIndex(index);
      const element = document.getElementById(`block-${index}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      setActiveBlockIndex(null);
    }
  }, [searchTerm, extracted, selectedText]);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    setScrollPos({
      top: e.currentTarget.scrollTop,
      left: e.currentTarget.scrollLeft
    });
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    
    // If no text is selected (cursor click), reset everything
    if (start === end) {
      setSelectedText('');
      setActiveBlockIndex(null);
      return;
    }

    const text = target.value.substring(start, end).trim();

    if (!text) {
      setSelectedText('');
      setActiveBlockIndex(null);
      return;
    }

    setSelectedText(text);

    // Find the first block that contains this text (regardless of where it was selected)
    const index = extracted.findIndex(item => JSON.stringify(item.parsed).includes(text));

    if (index !== -1) {
      setActiveBlockIndex(index);
      const element = document.getElementById(`block-${index}`);
      if (element) {
        // Use 'nearest' to avoid jumping if the element is already visible
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else {
      setActiveBlockIndex(null);
    }
  };

  const renderHighlightedText = () => {
    if (!input) return null;
    if (extracted.length === 0) return input;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    extracted.forEach((item, idx) => {
      // Text before the JSON block
      if (item.startIndex > lastIndex) {
        parts.push(input.substring(lastIndex, item.startIndex));
      }
      // The JSON block itself
      parts.push(
        <span 
          key={idx} 
          className="bg-emerald-500/5 border-b border-emerald-500/10 rounded-sm text-transparent"
        >
          {input.substring(item.startIndex, item.endIndex)}
        </span>
      );
      lastIndex = item.endIndex;
    });

    // Remaining text
    if (lastIndex < input.length) {
      parts.push(input.substring(lastIndex));
    }

    return parts;
  };

  return (
    <div className="min-h-screen bg-[#18181b] text-zinc-400 font-sans selection:bg-zinc-800 selection:text-zinc-200">
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-[#18181b]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center border border-zinc-700">
              <FileJson size={18} className="text-zinc-300" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-zinc-300 uppercase">JSON.EXTRACTOR</h1>
              <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">v1.0.0 // LOW_CONTRAST_MODE</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-amber-600/70" />
              <span>Latency: <span className="text-zinc-500">{parseTime.toFixed(2)}ms</span></span>
            </div>
            <div className="flex items-center gap-2">
              <Search size={12} className="text-zinc-500" />
              <span>Found: <span className="text-zinc-500">{extracted.length} blocks</span></span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-64px)]">
        {/* Input Section */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex items-center justify-between px-1">
            <label className="text-[11px] font-serif italic text-zinc-500 uppercase tracking-widest">Raw Input Stream</label>
            <button 
              onClick={clearInput}
              className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 size={12} />
              CLEAR_BUFFER
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50">
            {/* Highlight Layer */}
            <div 
              className="absolute inset-0 p-4 font-mono text-sm leading-6 whitespace-pre-wrap break-all pointer-events-none text-transparent border border-transparent antialiased"
              style={{ 
                transform: `translate(${-scrollPos.left}px, ${-scrollPos.top}px)`,
              }}
            >
              {renderHighlightedText()}
            </div>
            
            {/* Textarea Layer */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onScroll={handleScroll}
              onSelect={handleSelect}
              placeholder="Paste your text containing JSON here..."
              className="absolute inset-0 w-full h-full bg-transparent p-4 font-mono text-sm leading-6 resize-none focus:outline-none placeholder:text-zinc-800 caret-zinc-500 text-zinc-400 whitespace-pre-wrap break-all border-none antialiased overflow-auto custom-scrollbar"
              spellCheck={false}
            />

            {input.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="text-center">
                  <FileJson size={48} className="mx-auto mb-4" />
                  <p className="font-mono text-xs uppercase tracking-[0.2em]">Waiting for input...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Output Section */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="flex items-center justify-between px-1">
            <label className="text-[11px] font-serif italic text-zinc-500 uppercase tracking-widest">Extracted Objects</label>
            {extracted.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-emerald-500/70 transition-colors" />
                  <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Quick search..."
                    className="bg-zinc-900 border border-zinc-800 rounded py-1 pl-7 pr-8 text-[10px] font-mono focus:outline-none focus:border-emerald-500/30 transition-all placeholder:text-zinc-700 w-32 focus:w-48"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {extracted.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center border border-zinc-800 border-dashed rounded-lg bg-zinc-900/20 text-zinc-600">
                <AlertCircle size={24} className="mb-2 opacity-20" />
                <p className="text-[10px] font-mono uppercase tracking-widest">No parsable JSON detected</p>
              </div>
            ) : (
              extracted.map((item, idx) => (
                <div 
                  key={idx} 
                  id={`block-${idx}`}
                  className={cn(
                    "bg-zinc-900/80 border rounded-lg overflow-hidden flex flex-col group transition-all duration-300",
                    activeBlockIndex === idx ? "border-emerald-500/50 ring-1 ring-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]" : "border-zinc-800"
                  )}
                >
                  <div className={cn(
                    "px-4 py-2 flex items-center justify-between border-b transition-colors",
                    activeBlockIndex === idx ? "bg-emerald-500/10 border-emerald-500/20" : "bg-zinc-800/50 border-zinc-800"
                  )}>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors",
                        activeBlockIndex === idx ? "bg-emerald-500 text-white" : "bg-zinc-700 text-zinc-300"
                      )}>
                        BLOCK_{String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        OFFSET: {item.startIndex}..{item.endIndex}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleCopy(JSON.stringify(item.parsed, null, 2), idx)}
                      className="text-zinc-500 hover:text-white transition-colors p-1"
                      title="Copy to clipboard"
                    >
                      {copied === idx ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <JsonNode data={item.parsed} highlightText={searchTerm || selectedText} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}} />
    </div>
  );
}
