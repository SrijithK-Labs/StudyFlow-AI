"use client";

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Hash, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface JoinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onJoined: (workspaceId: string) => void;
}

export default function JoinModal({ isOpen, onClose, onJoined }: JoinModalProps) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length < 6) return;

        setLoading(true);
        setError(null);
        const token = localStorage.getItem('studyflow_token');

        try {
            const hostname = window.location.hostname;
            const API_URL = `${window.location.protocol}//${hostname}:8000`;
            const response = await fetch(`${API_URL}/api/v1/workspaces/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess(`Joined "${data.title}"`);
                setTimeout(() => {
                    onJoined(data.workspace_id);
                    onClose();
                    setSuccess(null);
                    setCode('');
                }, 1500);
            } else {
                setError(data.detail || 'Invalid or expired code');
            }
        } catch {
            setError('Connection failed');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (val: string) => {
        const clean = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
        setCode(clean);
        setError(null);
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
                                    <Hash className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Join Workspace</h2>
                                    <p className="text-[10px] sm:text-[11px] text-white/30 font-semibold uppercase tracking-widest mt-0.5">Enter invite code</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-all"
                            >
                                <X className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleJoin} className="px-5 sm:px-8 pb-6 sm:pb-8 pt-5 sm:pt-6 space-y-5 sm:space-y-6">
                            {/* Code Input */}
                            <div className="space-y-2.5 sm:space-y-3">
                                <label className="block text-[10px] sm:text-[11px] font-bold text-white/40 uppercase tracking-[0.15em] pl-1">
                                    6-Digit Code
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        maxLength={6}
                                        placeholder="X1Y2Z3"
                                        value={code}
                                        onChange={(e) => handleChange(e.target.value)}
                                        className="w-full text-center text-2xl sm:text-3xl font-mono font-black tracking-[0.4em] sm:tracking-[0.5em] pl-[0.4em] sm:pl-[0.5em] py-3.5 sm:py-4 px-4 sm:px-6 bg-white/[0.03] border border-white/[0.06] rounded-xl sm:rounded-2xl focus:border-primary/50 focus:bg-primary/[0.03] outline-none transition-all duration-300 text-white placeholder:text-white/10"
                                        autoFocus
                                    />
                                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                                        {[0, 1, 2, 3, 4, 5].map((i) => (
                                            <div
                                                key={i}
                                                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                                    i < code.length ? 'bg-primary scale-110' : 'bg-white/10'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Error */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-3.5 bg-red-500/[0.08] border border-red-500/20 rounded-lg sm:rounded-xl text-red-400 text-xs sm:text-sm">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            <span className="font-medium">{error}</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Success */}
                            <AnimatePresence>
                                {success && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-3.5 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-lg sm:rounded-xl text-emerald-400 text-xs sm:text-sm">
                                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                                            <span className="font-medium">{success}</span>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading || code.length < 6}
                                className="w-full py-3 sm:py-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-2.5 group"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 sm:w-[18px] sm:h-[18px] animate-spin" />
                                ) : (
                                    <>
                                        Join Workspace
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
