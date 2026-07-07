"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, FileText, Download, Video } from "lucide-react";

interface DocumentPreviewProps {
    document: {
        name: string;
        content_text: string;
        file_type: string;
    } | null;
    onClose: () => void;
}

export default function DocumentPreview({ document, onClose }: DocumentPreviewProps) {
    if (!document) return null;

    const isYouTube = document.name.toLowerCase().includes("youtube") || document.file_type === "youtube";

    const handleDownload = () => {
        const blob = new Blob([document.content_text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = `${document.name}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (typeof window === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 bg-black/70 backdrop-blur-xl"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 24 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 24 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="w-full max-w-4xl max-h-[85vh] relative"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="absolute -inset-px rounded-[2rem] bg-gradient-to-b from-primary/15 via-transparent to-transparent opacity-50" />

                    <div className="relative bg-[#0a0a0c] border border-white/[0.08] rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden h-full max-h-[85vh]">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.04]">
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    {isYouTube ? (
                                        <Video className="w-5 h-5 text-red-400" />
                                    ) : (
                                        <FileText className="w-5 h-5 text-primary" />
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-tight leading-tight">{document.name}</h2>
                                    <p className="text-[11px] text-white/30 font-semibold uppercase tracking-widest mt-0.5">
                                        {isYouTube ? 'YouTube Summary' : `${document.file_type} Document`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-all"
                            >
                                <X className="w-4.5 h-4.5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-8 md:px-12 py-8 scrollbar-hide">
                            <div className="prose prose-invert prose-primary prose-headings:text-white prose-p:text-white/70 prose-li:text-white/70 prose-strong:text-white/90 prose-code:text-primary/80 prose-code:bg-primary/[0.06] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/[0.03] prose-pre:border prose-pre:border-white/[0.06] max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {document.content_text}
                                </ReactMarkdown>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-white/[0.04]">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] text-white/50 hover:text-white text-sm font-medium transition-all"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleDownload}
                                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Download .md
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        window.document.body
    );
}
