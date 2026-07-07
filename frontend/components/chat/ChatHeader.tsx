"use client";

import React, { useState } from 'react';
import InviteModal from './InviteModal';
import MembersModal from './MembersModal';

interface ChatHeaderProps {
    title: string;
    workspaceId: string;
    memberCount?: number;
    isOwner?: boolean;
    ownerEmail?: string;
    onLeave?: () => void;
    chatMode?: "ai" | "member";
    onChatModeChange?: (mode: "ai" | "member") => void;
    onPodcastClick?: () => void;
    isGeneratingPodcast?: boolean;
    isSelecting?: boolean;
    selectedCount?: number;
    onCancelSelection?: () => void;
    onCallClick?: () => void;
    onDownloadClick?: () => void;
    onMenuClick?: () => void;
}

export default function ChatHeader({
    title,
    workspaceId,
    memberCount,
    isOwner,
    ownerEmail,
    onLeave,
    chatMode,
    onChatModeChange,
    onPodcastClick,
    isGeneratingPodcast,
    isSelecting,
    selectedCount,
    onCancelSelection,
    onCallClick,
    onDownloadClick,
    onMenuClick
}: ChatHeaderProps) {
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [isMembersOpen, setIsMembersOpen] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    const handleLeave = async () => {
        if (!confirm("Are you sure you want to leave this workspace?")) return;

        setIsLeaving(true);
        const token = localStorage.getItem('studyflow_token');
        try {
            const hostname = window.location.hostname;
            const API_URL = `${window.location.protocol}//${hostname}:8000`;
            const response = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/leave`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                if (onLeave) onLeave();
                window.location.reload(); // Simple way to refresh state
            } else {
                alert("Failed to leave workspace");
            }
        } catch (error) {
            console.error("Leave error:", error);
        } finally {
            setIsLeaving(false);
        }
    };

    return (
        <header className="flex flex-col glass border-b border-white/5 z-10 transition-all duration-300">
            {/* Top row: Title and Action Buttons */}
            <div className="h-14 md:h-16 flex items-center justify-between px-2 md:px-8">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                        onClick={onMenuClick}
                        className="md:hidden p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 shrink-0"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div className="flex flex-col min-w-0">
                        <h2 className="font-bold flex items-center gap-2 text-sm md:text-base truncate">
                            {workspaceId && <span className="text-foreground/40 shrink-0">#</span>}
                            <span className="truncate">{workspaceId ? title : "StudyFlow AI"}</span>
                        </h2>
                        {workspaceId && !isOwner && ownerEmail && (
                            <span className="text-[10px] text-foreground/40 font-medium line-clamp-1 hidden sm:block">
                                Owner: <span className="text-primary/70">{ownerEmail}</span>
                            </span>
                        )}
                    </div>
                    {workspaceId && memberCount !== undefined && memberCount > 1 && (
                        <button
                            onClick={() => setIsMembersOpen(true)}
                            className="hidden md:flex px-3 py-1 bg-white/5 hover:bg-white/10 rounded-full border border-white/5 transition-all text-[10px] font-black text-white/50 hover:text-primary uppercase tracking-widest items-center gap-2 group ml-4 shrink-0"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            Workspace Members
                            <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-md text-[9px]">
                                {memberCount}
                            </span>
                        </button>
                    )}
                </div>

                {workspaceId && (
                    <div className="flex items-center gap-1 md:gap-4 shrink-0">
                        <div className="flex items-center gap-1 md:gap-2">
                            {chatMode === "ai" && (
                                <button
                                    onClick={onCallClick}
                                    className="hidden sm:flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 hover:scale-105 transition-all shadow-lg shadow-emerald-500/10"
                                >
                                    <span>📞</span>
                                    <span className="text-xs font-bold uppercase tracking-widest hidden md:inline">Voice Call</span>
                                </button>
                            )}
                            {isSelecting && (
                                <button
                                    onClick={onCancelSelection}
                                    className="text-[10px] uppercase tracking-widest font-bold text-foreground/40 hover:text-red-400 transition-colors px-1.5 py-1"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={onPodcastClick}
                                disabled={isGeneratingPodcast}
                                className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 rounded-xl border transition-all ${isSelecting ? 'bg-primary ring-4 ring-primary/20 scale-105 border-primary shadow-lg shadow-primary/20' : isGeneratingPodcast ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 hover:scale-105'}`}
                            >
                                <span className={isGeneratingPodcast ? 'animate-pulse' : ''}>{isSelecting ? '✨' : '🎧'}</span>
                                <span className="text-xs font-bold uppercase tracking-widest hidden lg:inline">
                                    {isGeneratingPodcast ? 'Generating...' : isSelecting ? `Generate (${selectedCount})` : 'Podcast'}
                                </span>
                            </button>
                            <button
                                onClick={onDownloadClick}
                                className="hidden sm:flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 rounded-xl border bg-cyan-500/10 border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/20 hover:scale-105 transition-all shadow-lg shadow-cyan-500/10"
                            >
                                <span>📥</span>
                                <span className="text-xs font-bold uppercase tracking-widest hidden md:inline">Download</span>
                            </button>
                        </div>
                        {isOwner ? (
                            <button
                                onClick={() => setIsInviteOpen(true)}
                                className="rounded-lg bg-surface px-2.5 md:px-4 py-1.5 text-xs font-semibold border border-white/5 hover:border-primary/50 transition-all"
                            >
                                Invite
                            </button>
                        ) : (
                            <button
                                onClick={handleLeave}
                                disabled={isLeaving}
                                className="rounded-lg bg-red-500/10 text-red-400 px-2.5 md:px-4 py-1.5 text-xs font-semibold border border-red-500/20 hover:bg-red-500/20 transition-all disabled:opacity-50"
                            >
                                {isLeaving ? '...' : 'Leave'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom row: AI Tutor vs Group Chat Toggle (Only shown in group workspaces) */}
            {workspaceId && memberCount !== undefined && memberCount > 1 && (
                <div className="h-12 md:h-14 flex items-center justify-center border-t border-white/5 bg-white/[0.02]">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shadow-inner">
                        <button
                            onClick={() => onChatModeChange?.("ai")}
                            className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-1.5 rounded-lg text-[11px] md:text-xs font-black transition-all duration-300 ${chatMode === "ai" ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" : "text-white/40 hover:text-white/60 hover:bg-white/5"}`}
                        >
                            <span>🤖</span> AI Tutor
                        </button>
                        <button
                            onClick={() => onChatModeChange?.("member")}
                            className={`flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-1.5 rounded-lg text-[11px] md:text-xs font-black transition-all duration-300 ${chatMode === "member" ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" : "text-white/40 hover:text-white/60 hover:bg-white/5"}`}
                        >
                            <span>👥</span> Group Chat
                        </button>
                    </div>
                </div>
            )}

            <InviteModal
                isOpen={isInviteOpen}
                onClose={() => setIsInviteOpen(false)}
                workspaceId={workspaceId}
                isOwner={!!isOwner}
                ownerEmail={ownerEmail || ""}
            />
            <MembersModal
                isOpen={isMembersOpen}
                onClose={() => setIsMembersOpen(false)}
                workspaceId={workspaceId}
                isOwner={!!isOwner}
                ownerEmail={ownerEmail || ""}
            />
        </header>
    );
}
