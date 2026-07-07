"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Search, RefreshCw, UserX, Shield, ShieldOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MembersModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string;
    isOwner: boolean;
    ownerEmail: string;
}

export default function MembersModal({ isOpen, onClose, workspaceId, isOwner, ownerEmail }: MembersModalProps) {
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (isOpen) fetchMembers();
    }, [isOpen, workspaceId]);

    const fetchMembers = async () => {
        setLoading(true);
        const token = localStorage.getItem('studyflow_token');
        try {
            const hostname = window.location.hostname;
            const API_URL = `${window.location.protocol}//${hostname}:8000`;
            const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/members`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                const list: any[] = Array.isArray(data) ? data : [];
                const hasOwner = list.some(m => m.user_email === ownerEmail);
                if (!hasOwner && ownerEmail) {
                    list.unshift({
                        user_email: ownerEmail,
                        role: 'OWNER',
                        can_message_ai: true,
                        status: 'ACCEPTED',
                        _isOwnerPlaceholder: true
                    });
                }
                setMembers(list);
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = async (memberEmail: string, currentStatus: boolean) => {
        if (!isOwner) return;
        const token = localStorage.getItem('studyflow_token');
        try {
            const hostname = window.location.hostname;
            const API_URL = `${window.location.protocol}//${hostname}:8000`;
            const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/members/${memberEmail}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ can_message_ai: !currentStatus })
            });
            if (res.ok) fetchMembers();
        } catch {
            // silent
        }
    };

    const kickMember = async (memberEmail: string) => {
        if (!isOwner) return;
        if (!confirm(`Remove ${memberEmail} from this workspace?`)) return;
        const token = localStorage.getItem('studyflow_token');
        try {
            const hostname = window.location.hostname;
            const API_URL = `${window.location.protocol}//${hostname}:8000`;
            const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/kick/${memberEmail}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchMembers();
        } catch {
            // silent
        }
    };

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return members.filter(m => m.user_email.toLowerCase().includes(q));
    }, [members, searchQuery]);

    if (!isOpen || typeof window === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xl">
                <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 24 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 24 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="w-full max-w-sm sm:max-w-lg relative mx-auto"
                >
                    <div className="absolute -inset-px rounded-2xl sm:rounded-[2rem] bg-gradient-to-b from-primary/20 via-transparent to-transparent opacity-60" />

                    <div className="relative bg-[#0a0a0c] border border-white/[0.08] rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)]">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 sm:w-32 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

                        {/* Header */}
                        <div className="px-5 sm:px-8 pt-5 sm:pt-8 pb-4 space-y-4 sm:space-y-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white tracking-tight">Members</h2>
                                        <p className="text-[11px] text-white/30 font-semibold uppercase tracking-widest mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''} total</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-all"
                                >
                                    <X className="w-4.5 h-4.5" />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                                <input
                                    type="text"
                                    placeholder="Search by email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/[0.06] focus:border-primary/40 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/20 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Members List */}
                        <div className="px-5 sm:px-8 pb-6 sm:pb-8 max-h-[50vh] overflow-y-auto space-y-2 scrollbar-hide">
                            {loading ? (
                                <div className="flex flex-col items-center py-16 gap-3 text-white/20">
                                    <RefreshCw className="w-6 h-6 animate-spin" />
                                    <p className="text-xs font-semibold uppercase tracking-widest">Loading members...</p>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="text-center py-16">
                                    <p className="text-sm text-white/20 font-medium">No members found</p>
                                </div>
                            ) : (
                                filtered.map((member, idx) => {
                                    const isMemberOwner = member._isOwnerPlaceholder || member.user_email.toLowerCase() === ownerEmail.toLowerCase();
                                    return (
                                        <motion.div
                                            key={member.user_email}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] rounded-xl transition-all group"
                                        >
                                            <div className="flex items-center gap-3.5 min-w-0">
                                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 border border-white/[0.06] flex items-center justify-center text-xs font-bold text-white shrink-0">
                                                    {member.user_email[0].toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-white/90 truncate">{member.user_email}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${isMemberOwner ? 'bg-amber-400' : 'bg-primary/60'}`} />
                                                        <p className="text-[10px] text-white/25 font-semibold uppercase tracking-wider">
                                                            {isMemberOwner ? 'Owner' : 'Member'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* AI Toggle */}
                                                {!isMemberOwner && isOwner && (
                                                    <button
                                                        onClick={() => togglePermission(member.user_email, member.can_message_ai)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                                                            member.can_message_ai
                                                                ? 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/[0.15]'
                                                                : 'bg-white/[0.03] border-white/[0.06] text-white/30 hover:bg-white/[0.06]'
                                                        }`}
                                                        title={member.can_message_ai ? 'AI access enabled' : 'AI access disabled'}
                                                    >
                                                        {member.can_message_ai ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                                                        {member.can_message_ai ? 'AI On' : 'AI Off'}
                                                    </button>
                                                )}

                                                {isMemberOwner && (
                                                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-amber-500/[0.08] border border-amber-500/15 text-amber-400">
                                                        <Shield className="w-3 h-3" />
                                                        Owner
                                                    </span>
                                                )}

                                                {/* Kick */}
                                                {!isMemberOwner && isOwner && (
                                                    <button
                                                        onClick={() => kickMember(member.user_email)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/[0.08] text-white/15 hover:text-red-400 transition-all"
                                                        title="Remove member"
                                                    >
                                                        <UserX className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
