"use client";

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '@/services/api';

interface Message {
    id: string;
    sender: string;
    sender_name?: string;
    sender_type: "user" | "ai" | "member";
    content: string;
    thinking?: string | null;
    created_at?: string | Date;
    sender_email?: string;
    audio_url?: string;
    sources?: Array<{ title: string; url: string; snippet?: string }>;
}

interface ChatBubbleProps {
    message: Message;
    isGrouped: boolean;
    isSelecting?: boolean;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
    markdownComponents: any;
    isCurrentUser?: boolean;
}

const getMemberColor = (name: string) => {
    const colors = [
        'text-blue-400', 'text-emerald-400', 'text-amber-400',
        'text-purple-400', 'text-rose-400', 'text-indigo-400',
        'text-cyan-400', 'text-orange-400'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export default function ChatBubble({
    message,
    isGrouped,
    isSelecting,
    isSelected,
    onSelect,
    markdownComponents,
    isCurrentUser
}: ChatBubbleProps) {
    const isUser = message.sender_type === 'user';
    const isAI = message.sender_type === 'ai';
    const isMember = message.sender_type === 'member';
    const [showThinking, setShowThinking] = useState(false);

    // Client-side reasoning extractor: fallback if backend didn't extract it
    const REASONING_STARTERS = [
        // Narrating the user's message
        "Okay, the user", "Okay, so the", "Okay. The user", "Okay. ",
        "Alright, the user", "Alright, so", "Alright. ",
        "The user says", "The user said", "The user asked", "The user wants", "The user just",
        "So the user", "So, the user", "Since the user",
        // Self-directed thinking
        "Let me think", "Let me analyze", "Let me check", "Let me consider", "Let me re-read",
        "Let's think", "Let's analyze", "Let's see", "Let's look", "Let's interpret",
        "I need to ", "I must ", "I'll analyze", "I'll think", "I should ",
        // Meta / instruction-following commentary
        "We are to ", "We need to ", "We should ", "We must ",
        "The instructions say", "The format rules", "Important: ", "Note: ",
        "Based on the instructions", "Based on the context", "Based on the format",
        "However, note", "However, the instruction",
        // Drafting
        "Possible response:", "Possible answer:", "Final response:", "My response:",
        "Draft:", "The response should", "The answer should",
        // Analysis starters
        "My thinking:", "My reasoning:", "My analysis:",
        "First, let me", "First message", "First, I",
        "Hmm, ", "Hmm.", "Now, the user", "Now for the",
        "Wait, ", "Wait -", "Wait.", "Wait—",
        "Looking at", "Looking at the",
        "In this case", "In this situation",
        "The response must", "The reply should",
        "Since this is", "Given that the user",
    ];

    // Helper: does a line look like reasoning?
    const isReasoningLine = (line: string) =>
        REASONING_STARTERS.some(s => line.trimStart().startsWith(s));

    const { displayContent, displayThinking } = React.useMemo(() => {
        // If backend already extracted thinking, use it
        if (message.thinking != null) {
            return { displayContent: message.content, displayThinking: message.thinking };
        }

        // Client-side fallback: detect reasoning in content
        if (!isAI) return { displayContent: message.content, displayThinking: null };

        const stripped = message.content.trim();
        if (!isReasoningLine(stripped)) {
            return { displayContent: message.content, displayThinking: null };
        }

        // Try splitting on double newlines first, then single newlines
        const tryDelimiters = ["\n\n", "\n"];
        for (const delim of tryDelimiters) {
            const parts = stripped.split(delim).filter(p => p.trim().length > 0);
            if (parts.length > 1) {
                let reasoningEnd = parts.length;
                for (let i = 0; i < parts.length; i++) {
                    const p = parts[i].trim();
                    if (!isReasoningLine(p) && p.length > 0) {
                        reasoningEnd = i;
                        break;
                    }
                }
                if (reasoningEnd > 0 && reasoningEnd < parts.length) {
                    return {
                        displayThinking: parts.slice(0, reasoningEnd).join(delim),
                        displayContent: parts.slice(reasoningEnd).join(delim),
                    };
                }
            }
        }

        return { displayContent: message.content, displayThinking: null };
    }, [message.content, message.thinking, isAI]);

    const hasThinking = isAI && displayThinking && displayThinking.trim().length > 0;

    // Fallback exactly to traditional logic if isCurrentUser is undefined
    const isRightAligned = isCurrentUser !== undefined ? isCurrentUser : isUser;

    const timestamp = message.created_at
        ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now';

    return (
        <motion.div
            initial={isGrouped ? { opacity: 0, y: 5 } : { opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex items-start gap-4 w-full ${isRightAligned ? 'flex-row-reverse' : ''} ${isGrouped ? 'mt-1' : 'mt-6'}`}
        >
            {/* Avatar */}
            {!isGrouped ? (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg shrink-0 ${isAI ? 'bg-gradient-study' : isUser ? 'bg-zinc-800 border border-white/10' : 'bg-surface border border-white/5'}`}
                >
                    {isAI ? 'SF' : message.sender.charAt(0).toUpperCase()}
                </motion.div>
            ) : (
                <div className="w-10 h-1 z-0 shrink-0" /* Spacer for grouped messages */ />
            )}

            <div className={`flex-1 flex flex-col min-w-0 max-w-[85%] md:max-w-[80%] ${isRightAligned ? 'items-end' : 'items-start'}`}>
                {/* Name & Time Label */}
                {!isGrouped && (
                    <div className={`flex items-center gap-2 mb-1.5 px-1 ${isRightAligned ? 'flex-row-reverse' : ''}`}>
                        <span className={`text-xs font-black uppercase tracking-wider ${isMember && !isRightAligned ? getMemberColor(message.sender_name || message.sender) : isAI ? 'text-primary' : 'text-foreground/60'}`}>
                            {message.sender_name || message.sender}
                        </span>
                        <span className="text-[9px] text-foreground/30 font-bold">{timestamp}</span>
                    </div>
                )}

                {/* Message Content */}
                <motion.div
                    onClick={() => isSelecting && isAI && onSelect?.(message.id)}
                    className={`
                        relative group transition-all duration-300 overflow-hidden
                        ${isSelecting && isAI ? 'cursor-pointer hover:ring-2 hover:ring-primary/50 hover:scale-[1.01]' : ''}
                        ${isSelected ? 'ring-4 ring-primary shadow-xl scale-[1.02]' : ''}
                        ${isRightAligned
                            ? 'bg-primary text-white rounded-2xl rounded-tr-none'
                            : 'glass border border-white/5 rounded-2xl rounded-tl-none'}
                        p-3 md:p-4 shadow-sm
                    `}
                >
                    {/* Selection Indicator */}
                    {isSelecting && isAI && (
                        <div className={`absolute top-2 right-2 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white scale-110' : 'bg-black/20 border-white/30'}`}>
                            {isSelected && <span className="text-[10px] text-primary font-black">✓</span>}
                        </div>
                    )}

                    {/* Thinking Dropdown */}
                    {hasThinking && (
                        <div className="mb-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowThinking(!showThinking); }}
                                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary/70 hover:text-primary transition-colors py-1 px-2 -ml-1 rounded-lg hover:bg-primary/10"
                            >
                                <span className="text-sm">{showThinking ? '🧠' : '✨'}</span>
                                <span>{showThinking ? 'Hide Thinking' : 'View Thinking'}</span>
                                <span className={`text-[8px] transition-transform duration-200 ${showThinking ? 'rotate-180' : ''}`}>▼</span>
                            </button>
                            <AnimatePresence>
                                {showThinking && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-foreground/50 leading-relaxed font-mono whitespace-pre-wrap">
                                            {displayThinking}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Markdown Content */}
                    <div className={`markdown-content prose prose-invert prose-sm max-w-none ${isRightAligned ? 'prose-p:text-white' : ''}`}>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={markdownComponents}
                        >
                            {displayContent.replace(/\[File Attached: .*?\] /g, "").replace(/\[File Attached: .*?\]/g, "")}
                        </ReactMarkdown>
                    </div>

                    {/* Sources / Citations */}
                    {isAI && message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2">
                                <span>🌐</span> Sources
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                {message.sources.map((src, i) => {
                                    let hostname = "";
                                    try {
                                        hostname = new URL(src.url).hostname;
                                    } catch (_) {
                                        hostname = src.url;
                                    }
                                    const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;

                                    return (
                                        <a
                                            key={i}
                                            href={src.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/15 transition-all text-left group/source"
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                                                <img
                                                    src={faviconUrl}
                                                    alt={hostname}
                                                    className="w-4 h-4 rounded-sm"
                                                    onError={(e) => {
                                                        (e.target as HTMLElement).style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-foreground/90 truncate group-hover/source:text-primary transition-colors">
                                                    {src.title || hostname}
                                                </div>
                                                <div className="text-[10px] text-foreground/45 truncate">
                                                    [{i + 1}] {hostname}
                                                </div>
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}



                    {/* Grouped Time Tick (Hidden until hover) */}
                    {isGrouped && (
                        <div className={`absolute transition-opacity opacity-0 group-hover:opacity-100 top-1/2 -translate-y-1/2 ${isRightAligned ? '-left-8' : '-right-8'}`}>
                            <span className="text-[8px] font-bold text-foreground/20">{timestamp}</span>
                        </div>
                    )}
                </motion.div>
            </div>
        </motion.div>
    );
}
