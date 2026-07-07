"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, X, Volume2, SkipBack, SkipForward, Headphones, AudioLines, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PodcastPlayerProps {
    audioUrl: string;
    onClose: () => void;
    title?: string;
    isGenerating?: boolean;
}

export default function PodcastPlayer({ audioUrl, onClose, title = "Study Session Podcast", isGenerating = false }: PodcastPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (audioUrl && audioRef.current && !isGenerating) {
            setError(null);
            audioRef.current.load();
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
        }
    }, [audioUrl, isGenerating]);

    const togglePlay = () => {
        if (isGenerating || error) return;
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(() => {
                    setError("Playback failed. Check if audio file exists.");
                });
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration);
        }
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAudioError = () => {
        setError("Audio failed to load. The file may be missing or inaccessible.");
        setIsPlaying(false);
    };

    return (
        <div className="glass-dark border border-white/10 rounded-3xl p-4 shadow-2xl backdrop-blur-3xl flex items-center gap-4 relative overflow-hidden ring-1 ring-white/5">
            {/* Background Pulse for AI Generation or Playing */}
            {(isPlaying || isGenerating) && !error && (
                <motion.div
                    animate={{ opacity: [0.05, 0.15, 0.05] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-primary/20 pointer-events-none"
                />
            )}

            {/* Cover Art / Icon */}
            <div className={`h-14 w-14 bg-gradient-to-br ${error ? 'from-red-500 to-red-700' : isGenerating ? 'from-amber-500 to-orange-600' : 'from-indigo-500 to-blue-600'} rounded-2xl flex items-center justify-center shadow-lg shrink-0 transition-colors duration-1000`}>
                {error ? (
                    <AlertCircle className="text-white w-7 h-7" />
                ) : isGenerating ? (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    >
                        <AudioLines className="text-white w-7 h-7" />
                    </motion.div>
                ) : (
                    <Headphones className="text-white w-7 h-7" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-white text-sm truncate uppercase tracking-wider">
                        {error ? 'Playback Error' : isGenerating ? 'Synthesizing Podcast...' : title}
                    </h3>
                    {!isGenerating && !error && (
                        <span className="text-[10px] text-white/40 font-mono">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    )}
                </div>

                {error ? (
                    <div className="text-[10px] text-red-400 font-medium truncate">
                        {error}
                    </div>
                ) : (
                    /* Waveform / Progress */
                    <div className="relative h-6 flex items-center gap-[2px] md:gap-[3px]">
                        {[...Array(24)].map((_, i) => (
                            <motion.div
                                key={i}
                                animate={(isPlaying || isGenerating) ? {
                                    height: [4, Math.random() * 16 + 4, 4],
                                    opacity: isGenerating ? [0.2, 0.5, 0.2] : 1
                                } : { height: 3 }}
                                transition={{
                                    duration: isGenerating ? 1.5 : (0.4 + Math.random() * 0.4),
                                    repeat: Infinity,
                                    delay: i * 0.05
                                }}
                                className={`flex-1 max-w-[3px] rounded-full transition-colors duration-300 ${isGenerating ? 'bg-amber-500/30' :
                                    (currentTime / duration > i / 24 ? 'bg-primary shadow-[0_0_8px_var(--primary)]' : 'bg-white/10')
                                    }`}
                            />
                        ))}
                        {!isGenerating && (
                            <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={currentTime}
                                onChange={(e) => {
                                    if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
                {!isGenerating && !error && (
                    <button
                        onClick={togglePlay}
                        className={`h-12 w-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl`}
                    >
                        {isPlaying ? <Pause fill="black" size={24} /> : <Play fill="black" size={24} className="ml-1" />}
                    </button>
                )}
                <button
                    onClick={onClose}
                    className="h-8 w-8 hover:bg-white/10 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>
            </div>

            <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onError={handleAudioError}
                hidden
            />
        </div>
    );
}
