"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { transcribeVoice, askAI, API_URL } from "@/services/api";

type CallState = "idle" | "listening" | "processing" | "thinking" | "speaking";

interface CallModeOverlayProps {
    workspaceId: string;
    onClose: () => void;
    onMessageInjected: (msg: any) => void;
}

export default function CallModeOverlay({ workspaceId, onClose, onMessageInjected }: CallModeOverlayProps) {
    const [callState, setCallState] = useState<CallState>("idle");
    const [transcript, setTranscript] = useState("");

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    const startListening = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstart = () => {
                setCallState("listening");
                setTranscript("");
            };

            mediaRecorder.onstop = async () => {
                setCallState("processing");
                // Free the microphone track temporarily
                stream.getTracks().forEach(track => track.stop());

                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                try {
                    // STT
                    const sttResult = await transcribeVoice(workspaceId, audioBlob);
                    if (!sttResult.transcript || !sttResult.transcript.trim()) {
                        // Empty audio recorded
                        setCallState("idle");
                        return;
                    }

                    const userText = sttResult.transcript;
                    setTranscript(userText);

                    // Manually push user message to UI
                    onMessageInjected({
                        id: Date.now().toString(),
                        sender: "You",
                        sender_type: "user",
                        content: userText,
                        created_at: new Date()
                    });

                    // AI 
                    setCallState("thinking");
                    // We request audio via isVoice = true
                    const aiResult = await askAI(workspaceId, userText, true);

                    if (aiResult.audio_url) {
                        setCallState("speaking");
                        if (audioPlayerRef.current) {
                            const fullUrl = aiResult.audio_url.startsWith("http") ? aiResult.audio_url : `${API_URL}${aiResult.audio_url}`;
                            audioPlayerRef.current.src = fullUrl;
                            audioPlayerRef.current.play();
                        }
                    } else {
                        // Edge case: no audio returned
                        setCallState("idle");
                        setTimeout(() => startListening(), 1000);
                    }
                } catch (err) {
                    console.error("Call Loop Error:", err);
                    setCallState("idle");
                }
            };

            mediaRecorder.start();
        } catch (err) {
            console.error(err);
            alert("Microphone access denied. Please allow permissions to use Call Mode.");
            onClose();
        }
    };

    const stopListeningAndSend = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
    };

    const handleAudioEnded = () => {
        // Automatically resume listening when AI finishes speaking
        setCallState("idle");
        startListening();
    };

    // Auto-start listening on mount
    useEffect(() => {
        startListening();
        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Render configuration based on state
    const getStateLabel = () => {
        switch (callState) {
            case "listening": return "Listening... (Tap to Send)";
            case "processing": return "Transcribing...";
            case "thinking": return "Thinking...";
            case "speaking": return "Speaking...";
            default: return "Ready";
        }
    };

    const getPulsingColor = () => {
        switch (callState) {
            case "listening": return "bg-red-500/30";
            case "processing": return "bg-blue-500/30";
            case "thinking": return "bg-purple-500/30";
            case "speaking": return "bg-green-500/30";
            default: return "bg-white/10";
        }
    };

    if (typeof window === 'undefined') return null;

    return createPortal(
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl"
        >
            {/* Top Bar */}
            <div className="absolute top-4 md:top-8 w-full px-4 md:px-8 flex justify-between items-center">
                <span className="text-white/40 font-bold uppercase tracking-widest text-xs">Active Call</span>
                <button
                    onClick={onClose}
                    className="w-10 h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/20 hover:text-red-400 rounded-full flex items-center justify-center transition-all text-lg md:text-xl"
                >
                    ✕
                </button>
            </div>

            {/* Hidden Audio Player for playback */}
            <audio ref={audioPlayerRef} onEnded={handleAudioEnded} className="hidden" autoPlay />

            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg px-8 text-center space-y-12">

                {/* Visualizer Orb */}
                <div
                    onClick={() => {
                        if (callState === "listening") {
                            stopListeningAndSend();
                        } else if (callState === "speaking") {
                            // Interrupt AI: Stop audio and listen again
                            if (audioPlayerRef.current) audioPlayerRef.current.pause();
                            setCallState("idle");
                            startListening();
                        } else if (callState === "idle") {
                            startListening();
                        }
                    }}
                    className={`relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center rounded-full cursor-pointer transition-all duration-500 ease-out group`}
                >
                    <div className={`absolute inset-0 rounded-full animate-ping-slow ${getPulsingColor()} opacity-50 transition-colors duration-700`} />
                    <div className={`absolute inset-4 rounded-full animate-pulse blur-xl ${getPulsingColor()} opacity-60 transition-colors duration-700`} />
                    <div className={`absolute inset-6 md:inset-8 rounded-full shadow-2xl glass-dark border border-white/10 flex items-center justify-center z-10 transition-all duration-300 ${callState === 'listening' ? 'group-hover:scale-95 group-hover:border-red-500/50' : ''}`}>
                        {callState === "listening" && <span className="text-4xl md:text-6xl animate-bounce">🎙️</span>}
                        {callState === "processing" && <span className="text-4xl md:text-6xl animate-spin">⏳</span>}
                        {callState === "thinking" && <span className="text-4xl md:text-6xl opacity-50">🤔</span>}
                        {callState === "speaking" && <span className="text-4xl md:text-6xl animate-pulse">🔊</span>}
                        {callState === "idle" && <span className="text-4xl md:text-6xl opacity-50">💤</span>}
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className={`text-2xl font-black uppercase tracking-widest transition-colors duration-300 ${callState === 'listening' ? 'text-white' : 'text-primary'}`}>
                        {getStateLabel()}
                    </h2>

                    <p className="text-white/50 text-sm h-12 flex items-center justify-center">
                        {transcript || "Speak clearly into the microphone."}
                    </p>
                </div>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-8 text-xs text-white/30 font-medium uppercase tracking-widest">
                {callState === "speaking" ? "Tap to Interrupt" : callState === "listening" ? "Tap to Stop & Send" : ""}
            </div>
        </motion.div>,
        document.body
    );
}
