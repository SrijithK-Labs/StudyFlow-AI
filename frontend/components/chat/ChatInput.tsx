"use client";

import { useState, useRef, useEffect } from "react";
import { transcribeVoice } from "@/services/api";

interface ChatInputProps {
    workspaceId: string;
    onSendMessage: (content: string, files: File[], isVoice?: boolean) => void;
    onYouTubeUrl: (url: string) => void;
    disabled?: boolean;
    isThinking?: boolean;
    canMessageAI?: boolean;
    chatMode?: "ai" | "member";
}

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];

export default function ChatInput({ workspaceId, onSendMessage, onYouTubeUrl, disabled, isThinking, canMessageAI = true, chatMode = "ai" }: ChatInputProps) {
    const [message, setMessage] = useState("");
    const [ytMode, setYtMode] = useState(false);
    const [ytUrl, setYtUrl] = useState("");
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const [fileError, setFileError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
        };
    }, []);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((message.trim() || stagedFiles.length > 0) && !disabled) {
            onSendMessage(message, stagedFiles);
            setMessage("");
            setStagedFiles([]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const valid: File[] = [];
        const rejected: string[] = [];
        for (const f of files) {
            const ext = '.' + f.name.split('.').pop()?.toLowerCase();
            if (ALLOWED_EXTENSIONS.includes(ext)) {
                valid.push(f);
            } else {
                rejected.push(f.name);
            }
        }
        if (rejected.length > 0) {
            setFileError(`Unsupported file${rejected.length > 1 ? 's' : ''}: ${rejected.join(', ')}. Only PDF, DOC, DOCX, and TXT are supported.`);
            if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
            errorTimeoutRef.current = setTimeout(() => setFileError(null), 5000);
        }
        setStagedFiles(prev => [...prev, ...valid]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (index: number) => {
        setStagedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const isGroupChat = chatMode === "member";
    const isAIDisabled = !canMessageAI && !isGroupChat;
    const isDisabled = disabled || isAIDisabled;

    return (
        <div className="p-3 md:p-8">
            {!canMessageAI && !isGroupChat && (
                <div className="max-w-4xl mx-auto mb-3 px-4 py-2.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 flex items-center gap-3">
                    <span className="text-sm">🔒</span>
                    <p className="text-xs text-amber-400/80 font-medium">AI access has been disabled by the workspace owner. You can still use Group Chat.</p>
                </div>
            )}
            {fileError && (
                <div className="max-w-4xl mx-auto mb-3 px-4 py-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <span className="text-sm">⚠️</span>
                    <p className="text-xs text-red-400/80 font-medium">{fileError}</p>
                </div>
            )}
            <div className="max-w-4xl mx-auto mb-4 flex flex-wrap gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {stagedFiles.map((file, index) => (
                    <div
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-3 bg-white/5 border border-white/10 p-2 rounded-xl min-w-[180px] max-w-[250px] relative group animate-in fade-in slide-in-from-bottom-2"
                    >
                        <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center text-red-400 font-bold text-xs">
                            PDF
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="text-xs font-medium truncate text-white/90">{file.name}</div>
                            <div className="text-[10px] text-white/40 uppercase">{(file.size / 1024).toFixed(0)} KB</div>
                        </div>
                        <button
                            onClick={() => removeFile(index)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full flex items-center justify-center text-[10px] backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            <form
                onSubmit={handleSubmit}
                className={`max-w-4xl mx-auto glass-dark rounded-2xl border p-2 flex items-end gap-2 shadow-2xl focus-within:border-primary/50 transition-all ${isDisabled ? 'border-amber-500/20 opacity-60' : 'border-white/10'}`}
            >
                <div className="relative">
                    <input
                        type="file"
                        id="chat-upload"
                        ref={fileInputRef}
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                        accept=".pdf,.doc,.docx,.txt"
                    />
                    <label
                        htmlFor={isDisabled ? undefined : "chat-upload"}
                        className={`p-3 rounded-xl transition-colors text-xl block ${isDisabled ? 'opacity-50 cursor-not-allowed grayscale pointer-events-none' : 'hover:bg-white/5 cursor-pointer text-white/70'}`}
                    >
                        📎
                    </label>
                </div>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setYtMode(!ytMode)}
                        className={`p-3 rounded-xl transition-colors text-xl block ${isDisabled ? 'opacity-50 cursor-not-allowed grayscale pointer-events-none' : (ytMode ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-white/70')}`}
                        title="Summarize YouTube Video"
                    >
                        🎥
                    </button>
                    {ytMode && (
                        <div className="absolute bottom-full mb-4 left-0 w-72 md:w-80 glass-dark border border-primary/30 p-3 md:p-4 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200">
                            <div className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Summarize YouTube</div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={ytUrl}
                                    onChange={(e) => setYtUrl(e.target.value)}
                                    placeholder="Paste URL (https://youtube.com/...)"
                                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (ytUrl) {
                                            onYouTubeUrl(ytUrl);
                                            setYtUrl("");
                                            setYtMode(false);
                                        }
                                    }}
                                    className="px-3 bg-primary text-white rounded-lg text-xs font-bold"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    disabled={isDisabled || isThinking}
                    placeholder={isThinking ? "AI is thinking..." : isGroupChat ? "Type a message..." : isAIDisabled ? "AI access disabled..." : "Ask anything..."}
                    className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 px-2 max-h-40 scrollbar-hide text-sm disabled:opacity-50"
                    rows={1}
                />

                <button
                    type="submit"
                    disabled={isDisabled || (!message.trim() && stagedFiles.length === 0)}
                    className="p-3 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:grayscale"
                >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                </button>
            </form >
            <div className="text-center mt-3 text-[10px] text-foreground/30 font-medium">
                StudyFlow AI can make mistakes. Check important info.
            </div>
        </div >
    );
}
