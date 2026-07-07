"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Shield, Copy, RefreshCw, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceId: string;
    isOwner: boolean;
    ownerEmail: string;
}

export default function InviteModal({ isOpen, onClose, workspaceId, isOwner }: InviteModalProps) {
    const [code, setCode] = useState<string | null>(null);
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (expiresAt) {
            const interval = setInterval(() => {
                const now = new Date();
                const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
                setTimeLeft(diff);
                if (diff === 0) setCode(null);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [expiresAt]);

    const generateCode = async () => {
        setLoading(true);
        const token = localStorage.getItem('studyflow_token');
        try {
            const hostname = window.location.hostname;
            const API_URL = `${window.location.protocol}//${hostname}:8000`;
            const response = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}/generate-code`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setCode(data.code);
                setExpiresAt(new Date(data.expires_at));
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        if (code) {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!isOpen || typeof window === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xl">
                <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 24 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 24 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="w-full max-w-sm sm:max-w-md relative mx-auto"
                >
                    <div className="absolute -inset-px rounded-2xl sm:rounded-[2rem] bg-gradient-to-b from-primary/20 via-transparent to-transparent opacity-60" />

                    <div className="relative bg-[#0a0a0c] border border-white/[0.08] rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)]">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 sm:w-32 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 sm:px-8 pt-5 sm:pt-8 pb-2">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Invite Members</h2>
                                    <p className="text-[10px] sm:text-[11px] text-white/30 font-semibold uppercase tracking-widest mt-0.5">Share access code</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-all"
                            >
                                <X className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                            </button>
                        </div>

                        <div className="px-5 sm:px-8 pb-6 sm:pb-8 pt-5 sm:pt-6 space-y-5 sm:space-y-6">
                            <AnimatePresence mode="wait">
                                {!code ? (
                                    <motion.div
                                        key="generate"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="space-y-5 sm:space-y-6"
                                    >
                                        <div className="flex flex-col items-center py-6 sm:py-8 space-y-4 sm:space-y-5">
                                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-primary/[0.06] border border-primary/10 flex items-center justify-center">
                                                <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-primary/50" />
                                            </div>
                                            <div className="text-center space-y-1.5 sm:space-y-2">
                                                <h3 className="font-bold text-white text-sm sm:text-base">Generate Invite Code</h3>
                                                <p className="text-xs sm:text-sm text-white/40 max-w-[240px] sm:max-w-[260px] leading-relaxed">
                                                    Create a temporary 6-digit code for others to join.
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={generateCode}
                                            disabled={loading}
                                            className="w-full py-3 sm:py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2 sm:gap-2.5 group"
                                        >
                                            {loading ? (
                                                <Loader2 className="w-4 h-4 sm:w-[18px] sm:h-[18px] animate-spin" />
                                            ) : (
                                                <>
                                                    <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                                                    Generate Code
                                                </>
                                            )}
                                        </button>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="code"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="space-y-4 sm:space-y-5"
                                    >
                                        {/* Code Card */}
                                        <div className="relative group">
                                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-indigo-500/20 rounded-xl sm:rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                                            <div className="relative bg-white/[0.02] border border-white/[0.06] rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center space-y-4 sm:space-y-5">
                                                <div className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-primary/[0.08] border border-primary/15 rounded-full">
                                                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                                    <span className="text-[9px] sm:text-[10px] font-bold text-primary uppercase tracking-widest">Active</span>
                                                </div>

                                                <div className="text-3xl sm:text-5xl font-mono font-black tracking-[0.3em] sm:tracking-[0.4em] text-white pl-[0.3em] sm:pl-[0.4em] select-all">
                                                    {code}
                                                </div>

                                                <button
                                                    onClick={copyToClipboard}
                                                    className={`w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 sm:gap-2.5 transition-all duration-200 border ${
                                                        copied
                                                            ? 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400'
                                                            : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06] hover:text-white hover:border-white/10'
                                                    }`}
                                                >
                                                    {copied ? (
                                                        <>
                                                            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                            Copied
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                            Copy Code
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Timer */}
                                        <div className="flex items-center justify-between p-3.5 sm:p-4 bg-white/[0.02] border border-white/[0.04] rounded-lg sm:rounded-xl">
                                            <div className="flex items-center gap-2.5 sm:gap-3">
                                                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-500/[0.08] border border-amber-500/15 flex items-center justify-center">
                                                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] sm:text-xs font-bold text-white/70">Expires in</p>
                                                    <p className="text-xs sm:text-sm font-mono font-bold text-amber-400">{formatTime(timeLeft)}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={generateCode}
                                                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-white/25 hover:text-primary transition-all"
                                                title="New code"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
