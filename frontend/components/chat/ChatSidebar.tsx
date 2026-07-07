"use client";

interface PodcastEntry {
    id: string;
    url: string;
    title: string;
    created_at: string;
}

interface Workspace {
    id: string;
    title: string;
    member_count: number;
    owner_email: string;
    podcasts?: PodcastEntry[];
}

interface ChatSidebarProps {
    workspaces: Workspace[];
    loading: boolean;
    activeWorkspaceId: string | null;
    onWorkspaceSelect: (id: string) => void;
    onNewWorkspace: () => void;
    onDeleteWorkspace: (id: string) => void;
    documents?: any[];
    onDeleteDocument: (id: string) => void;
    onDocumentSelect: (doc: any) => void;
    canMessageAI?: boolean;
    onPodcastSelect: (url: string) => void;
    onDeletePodcast: (workspaceId: string, podcastId: string) => void;
    onGenerateQuiz: () => void;
    onGenerateFlashcards: () => void;
}

import { useState, useEffect } from "react";
import { Trash2, Download, ExternalLink } from "lucide-react";
import JoinModal from "./JoinModal";
import { API_URL } from "@/services/api";

export default function ChatSidebar({ workspaces, loading, activeWorkspaceId, onWorkspaceSelect, onNewWorkspace, onDeleteWorkspace, documents, onDeleteDocument, onDocumentSelect, onPodcastSelect, onDeletePodcast, onGenerateQuiz, onGenerateFlashcards }: ChatSidebarProps) {
    const [userName, setUserName] = useState<string>("User Account");
    const [userPicture, setUserPicture] = useState<string>("");
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

    useEffect(() => {
        const storedName = localStorage.getItem("studyflow_user_name");
        const storedPicture = localStorage.getItem("studyflow_user_picture");
        if (storedName) setUserName(storedName);
        if (storedPicture) setUserPicture(storedPicture);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("studyflow_token");
        localStorage.removeItem("studyflow_user_name");
        localStorage.removeItem("studyflow_user_picture");
        window.location.href = "/login";
    };

    return (
        <aside className="w-80 h-full glass-dark border-r border-white/5 flex flex-col">
            <div className="p-6 border-b border-white/5 flex items-center gap-2">
                <img src="/asset/Logo.png" alt="StudyFlow Logo" className="h-8 w-8 object-contain" />
                <h1 className="font-bold tracking-tight">StudyFlow <span className="text-primary">AI</span></h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
                <div className="flex flex-col gap-2">
                    <button
                        onClick={onNewWorkspace}
                        className="w-full text-left p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-medium flex items-center gap-3 hover:bg-primary/20 transition-all group"
                    >
                        <span className="text-2xl group-hover:rotate-90 transition-transform">+</span>
                        <span>New Conversation</span>
                    </button>

                    <button
                        onClick={() => setIsJoinModalOpen(true)}
                        className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/10 text-foreground/70 font-medium flex items-center gap-3 hover:bg-white/10 transition-all group"
                    >
                        <span className="text-xl group-hover:scale-110 transition-transform">#</span>
                        <span>Join Workspace</span>
                    </button>
                </div>

                <JoinModal
                    isOpen={isJoinModalOpen}
                    onClose={() => setIsJoinModalOpen(false)}
                    onJoined={(id) => {
                        onWorkspaceSelect(id);
                        // The parent should ideally refresh workspaces list
                        window.location.reload(); // Simple way to refresh for now
                    }}
                />

                <div className="pt-4 pb-2 text-xs font-semibold text-foreground/40 uppercase tracking-widest px-2">Recent Workspaces</div>
                {loading && workspaces.length === 0 ? (
                    <div className="p-4 space-y-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />)}
                    </div>
                ) : (
                    workspaces.map((ws) => (
                        <div key={ws.id} className="relative group/ws">
                            <button
                                onClick={() => onWorkspaceSelect(ws.id)}
                                className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${activeWorkspaceId === ws.id ? 'bg-primary/10 text-primary' : 'hover:bg-white/5 text-foreground/70'}`}
                            >
                                <span className={`text-xl font-serif transition-colors ${activeWorkspaceId === ws.id ? 'text-primary' : 'opacity-50 group-hover/ws:text-primary'}`}>#</span>
                                <span className="truncate flex-1">{ws.title}</span>
                            </button>
                            {ws.owner_email === localStorage.getItem('studyflow_user_email') && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDeleteWorkspace(ws.id); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg opacity-0 group-hover/ws:opacity-100 hover:bg-red-400/10 hover:text-red-400 transition-all text-foreground/30"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))
                )}

                {activeWorkspaceId && documents && documents.length > 0 && (
                    <div className="pt-6">
                        <div className="text-xs font-semibold text-foreground/40 uppercase tracking-widest px-2 pb-2 flex items-center justify-between">
                            Documents
                            <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[10px]">{documents.length}</span>
                        </div>
                        <div className="space-y-1">
                            {documents.map((doc) => (
                                <div key={doc.id} className="relative group/doc">
                                    <button
                                        onClick={(e) => {
                                            if (doc.is_virtual || doc.content_text) {
                                                e.preventDefault();
                                                onDocumentSelect(doc);
                                            } else {
                                                window.open(doc.file_url, '_blank');
                                            }
                                        }}
                                        className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 text-foreground/70 text-sm flex items-center gap-3 group transition-all"
                                    >
                                        <span className="text-lg opacity-50 text-blue-400 shrink-0">
                                            {doc.is_virtual ? "✨" : "📄"}
                                        </span>
                                        <span className="truncate flex-1 pr-6 tracking-tight">{doc.name}</span>
                                        {(doc.is_virtual || doc.content_text) && <ExternalLink size={12} className="opacity-0 group-hover:opacity-40 transition-all" />}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id); }}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-lg opacity-0 group-hover/doc:opacity-100 hover:bg-red-400/10 hover:text-red-400 transition-all text-xs text-foreground/30"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeWorkspaceId && (
                    <div className="pt-6 space-y-2">
                        <div className="text-xs font-semibold text-foreground/40 uppercase tracking-widest px-2 pb-1">Learning Tools</div>
                        <button
                            onClick={onGenerateQuiz}
                            className="w-full text-left p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium flex items-center gap-3 hover:bg-indigo-500/20 transition-all group"
                        >
                            <span className="text-xl">📝</span>
                            <span>Generate Quiz</span>
                        </button>
                        <button
                            onClick={onGenerateFlashcards}
                            className="w-full text-left p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium flex items-center gap-3 hover:bg-emerald-500/20 transition-all group"
                        >
                            <span className="text-xl">🎴</span>
                            <span>Generate Cards</span>
                        </button>
                    </div>
                )}

                {(() => {
                    const activeWS = workspaces.find(w => w.id === activeWorkspaceId);
                    const podcasts = activeWS?.podcasts || [];
                    if (podcasts.length === 0) return null;

                    return (
                        <div className="pt-6 pb-20">
                            <div className="text-xs font-semibold text-foreground/40 uppercase tracking-widest px-2 pb-2 flex items-center justify-between">
                                Podcast Audio
                                <span className="bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded text-[10px]">{podcasts.length}</span>
                            </div>
                            <div className="space-y-1">
                                {podcasts.map((podcast) => (
                                    <div
                                        key={podcast.id}
                                        onClick={() => onPodcastSelect(podcast.url)}
                                        className="w-full text-left p-2.5 rounded-xl hover:bg-white/5 text-foreground/70 text-sm flex items-center gap-3 group transition-all cursor-pointer"
                                    >
                                        <span className="text-lg opacity-50 text-amber-400 shrink-0">🎧</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="truncate font-medium">{podcast.title}</div>
                                            <div className="text-[10px] opacity-40">{new Date(podcast.created_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}</div>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const fullUrl = podcast.url.startsWith('http') ? podcast.url : `${API_URL}${podcast.url}`;
                                                    const link = document.createElement('a');
                                                    link.href = fullUrl;
                                                    link.download = `${podcast.title}.mp3`;
                                                    link.target = "_blank";
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                }}
                                                className="p-1.5 hover:bg-white/10 rounded-lg text-foreground/40 hover:text-foreground/90 transition-colors"
                                                title="Download"
                                            >
                                                <Download size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (activeWorkspaceId) onDeletePodcast(activeWorkspaceId, podcast.id);
                                                }}
                                                className="p-1.5 hover:bg-red-500/20 rounded-lg text-foreground/40 hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}
            </div>

            <div className="p-4 border-t border-white/5">
                <div className="glass p-3 rounded-xl flex items-center gap-3 group/user">
                    {userPicture && userPicture !== "" ? (
                        <img
                            src={userPicture}
                            alt={userName}
                            className="h-9 w-9 rounded-full border border-white/10 shadow-lg object-cover"
                        />
                    ) : (
                        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary to-accent border border-white/10 shadow-lg" />
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate leading-none mb-1 text-white/90">{userName}</p>
                        <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider leading-none">Online</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-lg text-foreground/40 hover:text-red-400 hover:bg-red-400/10 transition-all flex items-center justify-center"
                        title="Sign Out"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>
        </aside>
    );
}
