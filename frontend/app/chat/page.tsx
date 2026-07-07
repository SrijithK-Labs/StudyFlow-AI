"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { toPng } from "html-to-image";
import { marked } from "marked";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWorkspaces, fetchMessages, createWorkspace, saveMessage, askAI, uploadDocument, fetchDocuments, deleteWorkspace, deleteDocument, fetchMemberMessages, sendMemberMessage, generatePodcast, fetchActiveModel, generateQuiz, generateFlashcards, processYouTubeUrl, API_URL } from "@/services/api";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatInput from "@/components/chat/ChatInput";
import D2Diagram from "@/components/chat/D2Diagram";
import PremiumDiagram from "@/components/chat/PremiumDiagram";
import MemoryLayoutDiagram from "@/components/chat/MemoryLayoutDiagram";
import PodcastPlayer from "@/components/chat/PodcastPlayer";
import DateSeparator from "@/components/chat/DateSeparator";
import ChatBubble from "@/components/chat/ChatBubble";
import QuizView from "@/components/chat/QuizView";
import FlashcardView from "@/components/chat/FlashcardView";
import DocumentPreview from "@/components/chat/DocumentPreview";
import CallModeOverlay from "@/components/chat/CallModeOverlay";
import { isSameDay } from 'date-fns';

import { io, Socket } from "socket.io-client";

interface PodcastEntry {
    id: string;
    url: string;
    title: string;
    created_at: string;
}

interface Workspace {
    id: string;
    title: string;
    description: string;
    icon: string;
    member_count: number;
    owner_email: string;
    podcasts?: PodcastEntry[];
}

interface Message {
    id: string;
    sender: string;
    sender_name?: string;
    sender_type: "user" | "ai" | "member";
    content: string;
    thinking?: string | null;
    created_at?: string | Date;
    sender_email?: string;
    sources?: Array<{ title: string; url: string; snippet?: string }>;
}

import AuthGuard from "@/components/auth/AuthGuard";

export default function ChatPage() {
    return (
        <AuthGuard>
            <ChatContent />
        </AuthGuard>
    );
}

function ChatContent() {
    const markdownComponents = useMemo(() => ({
        code({ node, inline, className, children, ...props }: any) {
            const match = /language-mermaid/.exec(className || "");
            const d2Match = /language-d2/.exec(className || "");

            let rawCode = Array.isArray(children) ? children.join("") : String(children);
            const chartCode = rawCode.replace(/\n$/, "");

            const isMermaidSyntax = /(?:graph|flowchart)\s+(?:LR|TD|RL|BT)|mindmap|sequenceDiagram|classDiagram|erDiagram|stateDiagram|gitGraph/i.test(chartCode);

            const isJsonDiagram = /language-json-diagram/.exec(className || "");
            const isPlainJson = /language-json/.exec(className || "");
            const isMemoryLayout = /language-memory-layout/.exec(className || "");

            // Memory layout detection: regex-based (handles invalid JSON with unquoted hex)
            const hasArrayOfPointers = /"type"\s*:\s*"array_of_pointers"/.test(chartCode);
            const hasContiguousBuffer = /"type"\s*:\s*"contiguous_buffer"/.test(chartCode);
            const hasPtrField = /"ptr"\s*:/.test(chartCode) || /"points_to"\s*:/.test(chartCode);
            const isMemoryLayoutRegex = (hasArrayOfPointers || hasContiguousBuffer) && hasPtrField;

            // Also try JSON parse for clean JSON
            let isMemoryLayoutJSON = false;
            try {
                const parsed = JSON.parse(chartCode);
                const keys = Object.keys(parsed);
                if (keys.length > 0 && parsed[keys[0]]?.type) {
                    const t = parsed[keys[0]].type;
                    isMemoryLayoutJSON = t === 'array_of_pointers' || t === 'contiguous_buffer';
                }
            } catch { }

            // Premium diagram: must have nodes+edges AND NOT be a memory layout
            const likelyDiagramJSON = chartCode.includes('"nodes"') && chartCode.includes('"edges"') && !isMemoryLayoutRegex;

            const msgId = currentMsgIdRef.current;

            if (!inline && (isMemoryLayout || isMemoryLayoutJSON || isMemoryLayoutRegex)) {
                let hasValidData = false;
                try {
                    let repaired = chartCode
                        .replace(/:\s*(0x[0-9a-fA-F]+)(?=[,}\]\s])/g, ': "$1"')
                        .replace(/,\s*([}\]])/g, '$1');
                    const parsed = JSON.parse(repaired);
                    const entries = Object.entries(parsed);
                    hasValidData = entries.some(([, s]: [string, any]) =>
                        s && s.layout && (Array.isArray(s.layout) ? s.layout.length > 0 : true)
                    );
                } catch { }
                if (!hasValidData) return null;
                return (
                    <div data-msgid={msgId} data-diagram="true" className="w-full my-6">
                        <MemoryLayoutDiagram data={chartCode} />
                    </div>
                );
            }

            if (!inline && (isJsonDiagram || (isPlainJson && likelyDiagramJSON))) {
                return (
                    <div data-msgid={msgId} data-diagram="true" className="w-full my-6">
                        <PremiumDiagram data={chartCode} />
                    </div>
                );
            }

            if (!inline && d2Match && !isMermaidSyntax) {
                return (
                    <div data-msgid={msgId} data-diagram="true" className="w-full my-6">
                        <D2Diagram code={chartCode} />
                    </div>
                );
            }

            return (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        },
    }), []);

    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [podcastUrl, setPodcastUrl] = useState<string | null>(null);
    const [podcastTitle, setPodcastTitle] = useState<string>("Study Session Podcast");
    const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const [currentUserPermission, setCurrentUserPermission] = useState<{ can_message_ai: boolean, is_owner: boolean }>({ can_message_ai: true, is_owner: false });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const activeWorkspaceIdRef = useRef<string | null>(null);
    const currentMsgIdRef = useRef<string>("");
    const [isCapturing, setIsCapturing] = useState(false);

    const [isThinking, setIsThinking] = useState(false);
    const [activeModel, setActiveModel] = useState("AI Tutor");
    const [chatMode, setChatMode] = useState<"ai" | "member">("ai");
    const [memberMessages, setMemberMessages] = useState<Message[]>([]);
    const [currentUserName, setCurrentUserName] = useState<string>("You");

    const [activeQuiz, setActiveQuiz] = useState<any>(null);
    const [activeCards, setActiveCards] = useState<any[] | null>(null);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
    const [isSummarizingYoutube, setIsSummarizingYoutube] = useState(false);
    const [activePreviewDoc, setActivePreviewDoc] = useState<any>(null);
    const [isCallModeActive, setIsCallModeActive] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    const handleGenerateQuiz = async () => {
        if (!activeWorkspaceId) return;
        setIsGeneratingQuiz(true);
        try {
            const quiz = await generateQuiz(activeWorkspaceId, documents.map((d: any) => d.id));
            setActiveQuiz(quiz);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsGeneratingQuiz(false);
        }
    };

    const handleGenerateFlashcards = async () => {
        if (!activeWorkspaceId) return;
        setIsGeneratingFlashcards(true);
        try {
            const cards = await generateFlashcards(activeWorkspaceId, documents.map((d: any) => d.id));
            setActiveCards(cards);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsGeneratingFlashcards(false);
        }
    };

    const handleYouTubeUrl = async (url: string) => {
        if (!activeWorkspaceId) return;
        setIsSummarizingYoutube(true);
        try {
            const newDoc = await processYouTubeUrl(activeWorkspaceId, url);
            setDocuments(prev => [newDoc, ...prev]);
            alert("YouTube summary generated successfully!");
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsSummarizingYoutube(false);
        }
    };

    const [isSelectingForPodcast, setIsSelectingForPodcast] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);

    const activeWorkspace = useMemo(() => workspaces.find(w => w.id === activeWorkspaceId), [workspaces, activeWorkspaceId]);

    const processedMessages = useMemo(() => {
        const raw = chatMode === "ai" ? messages : memberMessages;
        return raw.map((msg, i) => {
            const prev = raw[i - 1];
            const msgDate = msg.created_at ? new Date(msg.created_at) : new Date();
            const prevDate = prev?.created_at ? new Date(prev.created_at) : null;

            const isNewDay = !prevDate || !isSameDay(msgDate, prevDate);
            const isGrouped = !isNewDay && prev && (prev.sender_name || prev.sender) === (msg.sender_name || msg.sender) && prev.sender_type === msg.sender_type;

            return { ...msg, isNewDay, isGrouped };
        });
    }, [messages, memberMessages, chatMode]);

    const scrollToBottom = (force = false) => {
        if (autoScroll || force) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
    };

    const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const atBottom = scrollHeight - scrollTop <= clientHeight + 100;
        setAutoScroll(atBottom);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    useEffect(() => {
        const storedName = localStorage.getItem("studyflow_user_name");
        if (storedName) setCurrentUserName(storedName);
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [wsData, modelData] = await Promise.all([fetchWorkspaces(), fetchActiveModel()]);
            setWorkspaces(wsData);
            setActiveModel(modelData.model_name);

            if (wsData.length > 0 && !activeWorkspaceId) {
                const firstWs = wsData[0];
                const firstId = firstWs.id;

                const userEmail = localStorage.getItem('studyflow_user_email');
                const userName = localStorage.getItem('studyflow_user_name') || "You";
                setCurrentUserName(userName);
                const isOwner = firstWs.owner_email === userEmail;
                setCurrentUserPermission({ can_message_ai: true, is_owner: isOwner });

                setActiveWorkspaceId(firstId);
                const msgData = await fetchMessages(firstId);
                setMessages(msgData);
                const memMsgData = await fetchMemberMessages(firstId);
                setMemberMessages(memMsgData.map((m: any) => ({
                    id: m.id,
                    sender: m.sender_name,
                    sender_type: "member",
                    content: m.content,
                    created_at: m.created_at,
                    sender_email: m.sender_email
                })));
                const docData = await fetchDocuments(firstId);
                setDocuments(docData);

                activeWorkspaceIdRef.current = firstId;
                setActiveWorkspaceId(firstId);
            }
        } catch (err) {
            console.error("Error loading chat data:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        activeWorkspaceIdRef.current = activeWorkspaceId;
    }, [activeWorkspaceId]);

    useEffect(() => {
        loadData();
        const storedName = localStorage.getItem('studyflow_user_name');
        if (storedName) setCurrentUserName(storedName);
    }, []);

    useEffect(() => {
        const hostname = window.location.hostname || 'localhost';
        const newSocket = io(`http://${hostname}:8000`, {
            reconnectionAttempts: 5,
            timeout: 10000
        });

        setSocket(newSocket);

        newSocket.on('connect', () => {
            setSocketConnected(true);
            if (activeWorkspaceId) {
                newSocket.emit('join_workspace', { workspace_id: activeWorkspaceId });
            }
        });

        newSocket.on('disconnect', () => {
            setSocketConnected(false);
        });

        newSocket.on('new_message', (m: any) => {
            const msg: Message = {
                id: m.id,
                sender: m.sender_name || m.sender,
                sender_name: m.sender_name,
                sender_type: m.sender_type,
                content: m.content,
                thinking: m.thinking || null,
                sources: m.sources || null,
                created_at: m.created_at,
                sender_email: m.sender_email
            };
            setMessages(prev => {
                if (prev.some(existing => existing.id === msg.id)) return prev;
                return [...prev, msg];
            });
        });

        newSocket.on('new_member_message', (m: any) => {
            const msg: Message = {
                id: m.id,
                sender: m.sender_name || m.sender,
                sender_name: m.sender_name,
                sender_type: "member",
                content: m.content,
                created_at: m.created_at,
                sender_email: m.sender_email
            };
            setMemberMessages(prev => {
                if (prev.some(existing => existing.id === msg.id)) return prev;
                return [...prev, msg];
            });
        });

        newSocket.on('room_joined', (_payload: { workspace_id: string }) => {
        });

        newSocket.on('workspace_deleted', (payload: { workspace_id: string }) => {
            setWorkspaces(prev => prev.filter(ws => ws.id !== payload.workspace_id));
            setActiveWorkspaceId(currentId => {
                if (currentId === payload.workspace_id) {
                    alert("This workspace has been deleted by the owner.");
                    return null;
                }
                return currentId;
            });
        });

        newSocket.on('member_permission_updated', (data: { workspace_id: string, member_email: string, can_message_ai: boolean }) => {
            const userEmail = localStorage.getItem('studyflow_user_email');
            if (data.workspace_id === activeWorkspaceIdRef.current && data.member_email === userEmail) {
                setCurrentUserPermission(prev => ({ ...prev, can_message_ai: data.can_message_ai }));
                if (!data.can_message_ai) {
                    setChatMode("member");
                }
            }
        });

        newSocket.on('user_kicked', (data: { workspace_id: string, user_email: string }) => {
            const userEmail = localStorage.getItem('studyflow_user_email');
            if (data.workspace_id === activeWorkspaceIdRef.current && data.user_email === userEmail) {
                alert("You have been removed from this workspace.");
                window.location.reload();
            }
        });

        newSocket.on('member_removed', (data: { workspace_id: string, member_email: string }) => {
            if (data.workspace_id === activeWorkspaceIdRef.current) {
                loadData();
            }
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        if (socket && socketConnected && activeWorkspaceId) {
            socket.emit('join_workspace', { workspace_id: activeWorkspaceId });
        }
    }, [socket, socketConnected, activeWorkspaceId]);

    const handleWorkspaceSelect = async (id: string) => {
        const ws = workspaces.find(w => w.id === id);
        const userEmail = localStorage.getItem('studyflow_user_email');
        const isOwner = ws?.owner_email === userEmail;

        setCurrentUserPermission(prev => ({
            ...prev,
            is_owner: isOwner
        }));

        setActiveWorkspaceId(id);

        try {
            const rawMsgData = await fetchMessages(id);
            const msgData = rawMsgData.map((m: any) => ({
                id: m.id,
                sender: m.sender_name || m.sender,
                sender_name: m.sender_name,
                sender_type: m.sender_type,
                content: m.content,
                thinking: m.thinking || null,
                sources: m.sources || null,
                created_at: m.created_at,
                sender_email: m.sender_email
            }));
            setMessages(msgData);
            const memMsgData = await fetchMemberMessages(id);
            setMemberMessages(memMsgData.map((m: any) => ({
                id: m.id,
                sender: m.sender_name || m.sender,
                sender_name: m.sender_name,
                sender_type: "member",
                content: m.content,
                created_at: m.created_at,
                sender_email: m.sender_email
            })));
            const docData = await fetchDocuments(id);
            setDocuments(docData);

            if (!isOwner) {
                const hostname = window.location.hostname;
                const token = localStorage.getItem('studyflow_token');
                const memRes = await fetch(`http://${hostname}:8000/api/v1/workspaces/${id}/members`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const members = await memRes.json();
                if (Array.isArray(members)) {
                    const me = members.find((m: any) => m.user_email === userEmail);
                    setCurrentUserPermission({
                        can_message_ai: me ? me.can_message_ai : true,
                        is_owner: false
                    });
                }
            } else {
                setCurrentUserPermission({ can_message_ai: true, is_owner: true });
            }
        } catch (err) {
            console.error("Error loading messages/documents for workspace:", id, err);
        }
    };

    const handleSendMessage = async (content: string, files: File[] = [], isVoice: boolean = false) => {
        if ((!content.trim() && files.length === 0) || !activeWorkspaceId) return;

        if (chatMode === "member" || !currentUserPermission.can_message_ai) {
            try {
                await sendMemberMessage(activeWorkspaceId, content);
                return;
            } catch (err) {
                console.error("Failed to send member message:", err);
                return;
            }
        }

        setLoading(true);
        try {
            const uploadedDocs = [];
            for (const file of files) {
                try {
                    const newDoc = await uploadDocument(activeWorkspaceId, file);
                    setDocuments(prev => [newDoc, ...prev]);
                    uploadedDocs.push(file.name);
                } catch (err) {
                    console.error(`Failed to upload ${file.name}`, err);
                }
            }

            let finalContent = content;
            if (uploadedDocs.length > 0) {
                const fileList = uploadedDocs.map(name => `[File Attached: ${name}]`).join(" ");
                finalContent = `${fileList} ${content}`.trim();
            }

            const userMsg = await saveMessage(activeWorkspaceId, {
                sender: currentUserName,
                sender_type: "user",
                content: finalContent
            });

            setIsThinking(true);
            try {
                await askAI(activeWorkspaceId, finalContent, isVoice);
            } finally {
                setIsThinking(false);
            }
            setTimeout(() => scrollToBottom(true), 200);
        } catch (err) {
            console.error("Send failed:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleNewWorkspace = async () => {
        const title = prompt("Enter workspace name:");
        if (!title) return;

        try {
            const newWs = await createWorkspace(title);
            setWorkspaces(prev => [...prev, newWs]);
            setActiveWorkspaceId(newWs.id);
            setMessages([]);
            setDocuments([]);
        } catch (err) {
            console.error("Error creating workspace:", err);
        }
    };

    const handleDeleteWorkspace = async (id: string) => {
        if (!confirm("Are you sure you want to delete this workspace and all its data?")) return;
        try {
            await deleteWorkspace(id);
            setWorkspaces(prev => prev.filter(ws => ws.id !== id));
            if (activeWorkspaceId === id) {
                setActiveWorkspaceId(null);
                setMessages([]);
                setDocuments([]);
            }
        } catch (err) {
            console.error("Failed to delete workspace:", err);
            alert("Error deleting workspace");
        }
    };

    const handleDeleteDocument = async (id: string) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        try {
            await deleteDocument(id);
            setDocuments(prev => prev.filter(doc => doc.id !== id));
        } catch (err) {
            console.error("Failed to delete document:", err);
            alert("Error deleting document");
        }
    };

    const handlePodcastToggle = async () => {
        if (!activeWorkspaceId) return;

        // If we are currently selecting, and HAVE selected something, generate it!
        if (isSelectingForPodcast) {
            if (selectedMessageIds.length === 0) {
                // Just cancel if nothing selected
                setIsSelectingForPodcast(false);
                return;
            }

            setIsGeneratingPodcast(true);
            setPodcastUrl("loading");

            try {
                const data = await generatePodcast(activeWorkspaceId, selectedMessageIds);
                const podcastEntry = data.podcast;
                const fullUrl = podcastEntry.url.startsWith('http') ? podcastEntry.url : `${API_URL}${podcastEntry.url}`;
                const syncedEntry = { ...podcastEntry, url: fullUrl };

                setWorkspaces(prev => prev.map(ws =>
                    ws.id === activeWorkspaceId
                        ? { ...ws, podcasts: [...(ws.podcasts || []), syncedEntry] }
                        : ws
                ));

                setPodcastUrl(fullUrl);
                // Exit selection mode after success
                setIsSelectingForPodcast(false);
                setSelectedMessageIds([]);
            } catch (err: any) {
                console.error("Selective podcast generation failed:", err);
                setPodcastUrl(null);
                alert(`Selective podcast failed: ${err.message || "Unknown error"}`);
            } finally {
                setIsGeneratingPodcast(false);
            }
            return;
        }

        // Entering selection mode for the first time
        setIsSelectingForPodcast(true);
    };

    const handleDeletePodcast = async (workspaceId: string, podcastId: string) => {
        try {
            const { deletePodcast } = await import('@/services/api');
            await deletePodcast(workspaceId, podcastId);

            setWorkspaces(prev => prev.map(ws =>
                ws.id === workspaceId
                    ? { ...ws, podcasts: (ws.podcasts || []).filter(p => p.id !== podcastId) }
                    : ws
            ));

            const matchedPodcast = activeWorkspace?.podcasts?.find(p => p.id === podcastId);
            if (matchedPodcast && podcastUrl?.includes(matchedPodcast.url)) {
                setPodcastUrl(null);
            }
        } catch (err: any) {
            console.error("Failed to delete podcast:", err);
            alert("Failed to delete podcast. Please try again.");
        }
    };

    const downloadChat = async () => {
        const msgs = chatMode === "ai" ? messages : memberMessages;
        if (!msgs || msgs.length === 0) {
            alert("No messages to download.");
            return;
        }
        setIsCapturing(true);
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 300));

        // ── Configure marked to strip diagram code blocks ──
        const renderer = new marked.Renderer();
        renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
            const langStr = (lang || "").toLowerCase();
            if (langStr.includes("json-diagram") || langStr.includes("mermaid") || langStr.includes("d2") || langStr.includes("memory-layout")) {
                return "";
            }
            if (langStr.includes("json")) {
                try {
                    const parsed = JSON.parse(text);
                    const keys = Object.keys(parsed);
                    if (keys.length > 0 && parsed[keys[0]]?.type) {
                        const t = parsed[keys[0]].type;
                        if (t === "array_of_pointers" || t === "contiguous_buffer") return "";
                    }
                    if (parsed.nodes && parsed.edges) return "";
                } catch { }
            }
            const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<pre><code class="language-${langStr}">${escaped}</code></pre>`;
        };
        marked.setOptions({ renderer, breaks: true, gfm: true });

        // ── Capture diagram nodes as PNG ──
        const diagramEls = document.querySelectorAll<HTMLElement>('[data-diagram="true"]');
        const diagramMap = new Map<string, string>();
        for (const el of diagramEls) {
            const msgId = el.getAttribute('data-msgid') || '';
            if (!msgId) continue;
            try {
                const dataUrl = await toPng(el, { quality: 1, pixelRatio: 2, backgroundColor: '#020617' });
                if (dataUrl) {
                    diagramMap.set(msgId, (diagramMap.get(msgId) || '') + `<div class="diagram-img"><img src="${dataUrl}" alt="Diagram"></div>`);
                }
            } catch (e) {
                // diagram capture failed — non-critical
            }
        }

        const workspaceName = activeWorkspace?.title || "chat";
        const exportDate = new Date().toLocaleString();
        const safeName = workspaceName.replace(/[^a-zA-Z0-9]/g, '_');

        let html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${workspaceName} - Chat Export</title>
<style>
:root{--bg:#020617;--fg:#f8fafc;--primary:#818cf8;--secondary:#60a5fa;--accent:#22d3ee;--surface:#0f172a;--glass:rgba(255,255,255,0.05);--glass-border:rgba(255,255,255,0.1)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#020617;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif}
.pdf-page-container{background:#020617;color:#f8fafc;padding:40px 48px;width:100%;min-height:100vh}
.header{text-align:center;padding:40px 24px 32px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:32px}
.header h1{font-size:28px;font-weight:800;background:linear-gradient(135deg,var(--primary),var(--secondary),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-0.02em}
.header p{color:rgba(255,255,255,0.35);font-size:13px;margin-top:8px;font-weight:500}
.msg-row{display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;page-break-inside:avoid;break-inside:avoid}
.msg-row.right{flex-direction:row-reverse}
.msg-avatar{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;flex-shrink:0;box-shadow:0 4px 12px rgba(0,0,0,0.3)}
.msg-avatar.ai{background:linear-gradient(135deg,var(--primary),var(--secondary),var(--accent))}
.msg-avatar.user{background:var(--surface);border:1px solid rgba(255,255,255,0.1)}
.msg-avatar.member{background:var(--surface);border:1px solid rgba(255,255,255,0.05)}
.msg-col{flex:1;display:flex;flex-direction:column;max-width:80%}
.msg-col.right{align-items:flex-end}
.msg-meta{display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:0 4px}
.msg-meta.right{flex-direction:row-reverse}
.msg-name{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.05em;color:var(--primary)}
.msg-name.user{color:rgba(255,255,255,0.5)}
.msg-time{font-size:9px;color:rgba(255,255,255,0.25);font-weight:700}
.msg-bubble{position:relative;padding:16px 20px;line-height:1.7;font-size:14px;border-radius:16px 16px 16px 4px;background:var(--glass);backdrop-filter:blur(12px);border:1px solid var(--glass-border);color:rgba(255,255,255,0.85);box-shadow:0 4px 12px rgba(0,0,0,0.1)}
.msg-bubble.user{background:var(--primary);border-color:var(--primary);color:#fff;border-radius:16px 16px 4px 16px}
.msg-bubble p{margin-bottom:12px;line-height:1.7}
.msg-bubble p:last-child{margin-bottom:0}
.msg-bubble a{color:var(--secondary);text-decoration:underline}
.msg-bubble strong{color:#fff;font-weight:700}
.msg-bubble em{font-style:italic;color:rgba(255,255,255,0.9)}
.msg-bubble code{background:rgba(74,222,128,0.1);color:#4ade80;padding:2px 6px;border-radius:6px;font-size:13px}
.msg-bubble pre{background:#020617;border:1px solid rgba(255,255,255,0.05);border-radius:20px;padding:24px;overflow-x:auto;margin:20px 0;box-shadow:inset 0 2px 20px rgba(0,0,0,0.5);page-break-inside:avoid;break-inside:avoid}
.msg-bubble pre code{background:none;padding:0;color:#4ade80;font-size:13px;line-height:1.5}
.msg-bubble h1,.msg-bubble h2,.msg-bubble h3,.msg-bubble h4{margin-top:24px;margin-bottom:16px;font-weight:800;color:#fff;letter-spacing:-0.02em}
.msg-bubble h1{font-size:24px;border-bottom:2px solid rgba(129,140,248,0.2);padding-bottom:12px}
.msg-bubble h2{font-size:20px}
.msg-bubble h3{font-size:16px;color:var(--primary)}
.msg-bubble h4{font-size:14px;color:var(--primary)}
.msg-bubble table{width:100%;margin:16px 0;border-collapse:separate;border-spacing:0;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.05);background:rgba(15,23,42,0.3);page-break-inside:avoid;break-inside:avoid}
.msg-bubble th{background:linear-gradient(90deg,rgba(99,102,241,0.15),rgba(59,130,246,0.15));color:var(--primary);font-weight:700;padding:12px;text-align:left;text-transform:uppercase;font-size:11px;letter-spacing:0.1em;border-bottom:1px solid rgba(255,255,255,0.05)}
.msg-bubble td{padding:12px;color:rgba(255,255,255,0.7);border-bottom:1px solid rgba(255,255,255,0.03)}
.msg-bubble tr{page-break-inside:avoid;break-inside:avoid}
.msg-bubble tr:last-child td{border-bottom:none}
.msg-bubble blockquote{margin:16px 0;padding:16px 20px;background:linear-gradient(135deg,rgba(99,102,241,0.05),rgba(15,23,42,0.4));border-left:4px solid var(--primary);border-radius:12px 24px 24px 12px;position:relative;font-style:italic;color:rgba(255,255,255,0.9);page-break-inside:avoid;break-inside:avoid}
.msg-bubble blockquote p{margin-bottom:0}
.msg-bubble ul,.msg-bubble ol{margin-bottom:16px;padding-left:24px}
.msg-bubble li{margin-bottom:8px;color:rgba(255,255,255,0.8);page-break-inside:avoid;break-inside:avoid}
.msg-bubble li strong{color:#fff}
.msg-bubble hr{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:20px 0}
.msg-bubble del{text-decoration:line-through;color:rgba(255,255,255,0.5)}
.thinking-toggle{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(129,140,248,0.6);cursor:pointer;padding:4px 8px;margin:0 0 8px -4px;border-radius:8px;border:none;background:none}
.thinking-block{margin-top:8px;padding:12px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;font-size:12px;color:rgba(255,255,255,0.45);font-family:'SF Mono','Fira Code',monospace;line-height:1.6;white-space:pre-wrap;page-break-inside:avoid;break-inside:avoid}
.sources{margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05);page-break-inside:avoid;break-inside:avoid}
.sources-label{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.3);margin-bottom:8px}
.sources-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.source-link{display:flex;align-items:center;gap:8px;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:12px;text-decoration:none;color:rgba(255,255,255,0.7);font-size:12px;transition:all 0.2s}
.source-link:hover{background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.9)}
.source-link > div{min-width:0;flex:1}
.source-favicon-box{width:24px;height:24px;border-radius:8px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,0.08)}
.source-favicon{width:16px;height:16px;border-radius:4px}
.source-title{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.source-domain{font-size:10px;color:rgba(255,255,255,0.3);margin-top:2px}
.diagram-img{margin:16px 0;page-break-inside:avoid;break-inside:avoid}
.diagram-img img{width:100%;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.3)}
.separator{height:1px;background:rgba(255,255,255,0.04);margin:24px 0}
.footer{text-align:center;padding:40px 24px;color:rgba(255,255,255,0.15);font-size:12px;font-weight:500}
@media(max-width:640px){.sources-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="pdf-page-container">
<div class="header">
<h1>${workspaceName} — Chat Export</h1>
<p>Exported on ${exportDate} &middot; ${msgs.length} messages</p>
</div>`;

        for (const msg of msgs) {
            const sender = msg.sender || msg.sender_name || "Unknown";
            const isUser = msg.sender_type === "user";
            const isAi = msg.sender_type === "ai";
            const avatar = isAi ? "SF" : sender.charAt(0).toUpperCase();
            const typeLabel = isAi ? "AI" : isUser ? "You" : sender;
            const date = msg.created_at ? new Date(msg.created_at).toLocaleString() : "";
            const rightClass = isUser ? " right" : "";

            html += `<div class="msg-row${rightClass}">`;
            html += `<div class="msg-avatar ${msg.sender_type}">${avatar}</div>`;
            html += `<div class="msg-col${rightClass}">`;
            html += `<div class="msg-meta${rightClass}">`;
            html += `<span class="msg-name${isUser ? ' user' : ''}">${typeLabel}</span>`;
            if (date) html += `<span class="msg-time">${date}</span>`;
            html += `</div>`;
            html += `<div class="msg-bubble ${isUser ? 'user' : isAi ? 'ai' : 'member'}">`;

            // ── Render markdown to HTML ──
            const rawContent = (msg.content || "").replace(/\[File Attached: .*?\] /g, "").replace(/\[File Attached: .*?\]/g, "");
            if (isUser) {
                const escaped = rawContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                html += `<p>${escaped.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
            } else {
                html += marked.parse(rawContent);
            }

            // ── Inline diagram image (right after content, matching frontend) ──
            const diagramHtml = diagramMap.get(msg.id);
            if (diagramHtml) html += diagramHtml;

            if (msg.thinking) {
                const t = msg.thinking.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                html += `<div class="thinking-toggle">🧠 Why this response?</div>`;
                html += `<div class="thinking-block">${t}</div>`;
            }

            if (msg.sources && msg.sources.length > 0) {
                html += `<div class="sources"><div class="sources-label">🌐 Sources</div><div class="sources-grid">`;
                for (const src of msg.sources) {
                    let hostname = "";
                    try { hostname = new URL(src.url).hostname; } catch { hostname = src.url; }
                    html += `<a href="${src.url}" target="_blank" class="source-link">`;
                    html += `<span class="source-favicon-box"><img class="source-favicon" src="https://www.google.com/s2/favicons?sz=64&domain=${hostname}" onerror="this.style.display='none'" alt=""></span>`;
                    html += `<div><div class="source-title">${(src.title || hostname).replace(/</g, '&lt;')}</div>`;
                    html += `<div class="source-domain">${hostname}</div></div></a>`;
                }
                html += `</div></div>`;
            }

            html += `</div></div></div>`;
            html += `<div class="separator"></div>`;
        }

        html += `<div class="footer">Generated by StudyFlow AI</div></div></body></html>`;

        const div = document.createElement('div');
        div.style.cssText = 'width:960px;padding:0 24px;background:#020617;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;position:fixed;left:0;top:0;z-index:-1;pointer-events:none';
        let clean = html.replace(/<!DOCTYPE[^>]*>/i, '').replace(/<\/?html[^>]*>/gi, '').replace(/<\/?head[^>]*>/gi, '').replace(/<\/?body[^>]*>/gi, '').replace(/<meta[^>]*>/gi, '').replace(/<title[^>]*>.*?<\/title>/gi, '');
        div.innerHTML = clean;
        document.body.appendChild(div);
        try {
            await new Promise(r => requestAnimationFrame(r));
            const pw = div.scrollWidth;
            const ph = div.scrollHeight;

            const h2c = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            const canvas = await h2c(div, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#020617',
                logging: true,
                width: pw,
                height: ph,
                windowWidth: pw,
                windowHeight: ph,
                scrollY: 0
            });

            const pdf = new jsPDF('p', 'mm', 'a4');
            const margin = 10;
            const pageW = 210 - margin * 2;
            const pageH = 297 - margin * 2;
            const ratio = pageW / canvas.width;
            const sliceH = pageH / ratio;
            let y = 0;
            let page = 0;

            while (y < canvas.height) {
                const h = Math.min(sliceH, canvas.height - y);
                const tmp = document.createElement('canvas');
                tmp.width = canvas.width;
                tmp.height = Math.ceil(h);
                tmp.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
                if (page > 0) pdf.addPage();
                pdf.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, pageW, h * ratio);
                y += sliceH;
                page++;
            }

            pdf.save(`${safeName}_chat_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (e) {
            console.error('PDF generation error:', e);
        } finally {
            document.body.removeChild(div);
        }
        setIsCapturing(false);
    };


    return (
        <div className="flex h-screen bg-background overflow-hidden transition-all duration-500">
            {/* Mobile sidebar backdrop */}
            {isMobileSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsMobileSidebarOpen(false)}
                />
            )}
            <div className={`${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-50 md:z-auto h-full transition-transform duration-300 ease-out`}>
                <ChatSidebar
                    workspaces={workspaces}
                    loading={loading}
                    activeWorkspaceId={activeWorkspaceId}
                    onWorkspaceSelect={(id) => { handleWorkspaceSelect(id); setIsMobileSidebarOpen(false); }}
                    onNewWorkspace={handleNewWorkspace}
                    onDeleteWorkspace={handleDeleteWorkspace}
                    documents={documents}
                    onDeleteDocument={handleDeleteDocument}
                    onDocumentSelect={(doc) => { setActivePreviewDoc(doc); setIsMobileSidebarOpen(false); }}
                    canMessageAI={currentUserPermission.can_message_ai}
                    onPodcastSelect={setPodcastUrl}
                    onDeletePodcast={handleDeletePodcast}
                    onGenerateQuiz={handleGenerateQuiz}
                    onGenerateFlashcards={handleGenerateFlashcards}
                />
            </div>

            <main className="flex-1 flex flex-col relative min-w-0">
                <ChatHeader
                    title={activeWorkspace?.title || "AI Project Chat"}
                    workspaceId={activeWorkspaceId || ""}
                    memberCount={activeWorkspace?.member_count}
                    isOwner={currentUserPermission.is_owner}
                    ownerEmail={activeWorkspace?.owner_email}
                    chatMode={chatMode}
                    onChatModeChange={setChatMode}
                    onPodcastClick={handlePodcastToggle}
                    onCallClick={() => setIsCallModeActive(true)}
                    onDownloadClick={downloadChat}
                    isGeneratingPodcast={isGeneratingPodcast}
                    isSelecting={isSelectingForPodcast}
                    selectedCount={selectedMessageIds.length}
                    onCancelSelection={() => {
                        setIsSelectingForPodcast(false);
                        setSelectedMessageIds([]);
                    }}
                    onMenuClick={() => setIsMobileSidebarOpen(true)}
                />

                <div className="hidden md:flex absolute top-4 left-1/2 -translate-x-1/2 z-[100] items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-md border border-white/5 rounded-full shadow-lg pointer-events-none">
                    <div className={`h-2 w-2 rounded-full animate-pulse ${socketConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">
                        {socketConnected ? 'Live Connection active' : 'Connecting to server...'}
                    </span>
                </div>

                <div
                    ref={scrollContainerRef}
                    onScroll={handleContainerScroll}
                    className="flex-1 overflow-y-auto p-4 md:p-8 pt-6 space-y-6 md:space-y-8 scroll-smooth flex flex-col"
                >
                    {!activeWorkspaceId ? (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
                            <div className="text-center space-y-6">
                                <div className="relative inline-block">
                                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                                    <img src="/asset/Logo.png" alt="StudyFlow Logo" className="h-32 w-32 relative mx-auto mb-4 object-contain drop-shadow-2xl animate-bounce-slow" />
                                </div>
                                <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white/90 uppercase">
                                    StudyFlow <span className="text-primary">AI</span>
                                </h1>
                                <p className="text-foreground/40 text-base md:text-xl max-w-md mx-auto font-medium">
                                    Ready to master your studies? Create a workspace to start your personalized learning journey.
                                </p>
                            </div>
                            <button
                                onClick={handleNewWorkspace}
                                className="group relative px-8 py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-105 hover:shadow-primary/40 transition-all active:scale-95 flex items-center gap-3 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                                <span className="text-2xl">✨</span>
                                Create Your First Workspace
                            </button>
                        </div>
                    ) : (chatMode === "ai" ? messages : memberMessages).length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-12 animate-in fade-in zoom-in-95 duration-700">
                            <div className="text-center space-y-4">
                                <img src="/asset/Logo.png" alt="StudyFlow Logo" className="h-24 w-24 mx-auto mb-6 object-contain drop-shadow-2xl animate-bounce-slow" />
                                <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-white/90">
                                    {chatMode === "ai" ? "What do you want to learn today?" : "Welcome to Group Chat!"}
                                </h2>
                                <p className="text-foreground/40 text-sm md:text-lg max-w-lg mx-auto">
                                    {chatMode === "ai"
                                        ? "Upload your study materials and I'll teach you everything from scratch — like a personal professor preparing you for exams."
                                        : "Chat in real-time with your fellow workspace members. Brainstorm, collaborate, and share your study progress."}
                                </p>
                            </div>

                            {chatMode === "ai" && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl px-4">
                                    {[
                                        { icon: "📚", label: "Teach Me This Topic", prompt: "Teach me everything about this topic from absolute scratch. Cover all fundamentals, generate diagrams, include exam questions (2-mark, 5-mark, 10-mark), revision tables, memory tricks, and a complete summary. I should be able to pass my exam after reading your response." },
                                        { icon: "📊", label: "Explain with Diagrams", prompt: "Explain the key concepts from the uploaded documents using detailed Mermaid diagrams — flowcharts, mind maps, process flows, and classification trees. Explain each diagram after generating it." },
                                        { icon: "🎯", label: "Exam Preparation", prompt: "Generate a complete exam preparation guide from the uploaded documents. Include viva questions, 2-mark, 5-mark, and 10-mark questions with answers, common mistakes students make, one-page revision notes, and memory tricks." }
                                    ].map((item, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSendMessage(item.prompt)}
                                            className="glass-dark border border-white/5 p-6 rounded-2xl text-left hover:bg-white/5 hover:border-primary/30 transition-all flex flex-col gap-3 group"
                                        >
                                            <span className="text-2xl group-hover:scale-110 transition-transform w-fit">{item.icon}</span>
                                            <div className="space-y-1">
                                                <div className="font-bold text-white/80">{item.label}</div>
                                                <div className="text-xs text-foreground/40 line-clamp-2">{item.prompt}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <AnimatePresence mode="popLayout" initial={false}>
                                {processedMessages.map((msg: any, idx) => {
                                    currentMsgIdRef.current = msg.id;
                                    return (
                                        <motion.div
                                            key={msg.id || idx}
                                            data-msgid={msg.id}
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                        >
                                            {msg.isNewDay && <DateSeparator date={msg.created_at || new Date()} />}
                                            <ChatBubble
                                                message={{
                                                    ...msg,
                                                    sender: msg.sender_name || msg.sender
                                                }}
                                                isGrouped={msg.isGrouped}
                                                isCurrentUser={msg.sender_type === "user" || msg.sender_email === (typeof window !== 'undefined' ? localStorage.getItem('studyflow_user_email') : '')}
                                                isSelecting={isSelectingForPodcast}
                                                isSelected={selectedMessageIds.includes(msg.id)}
                                                onSelect={(id) => setSelectedMessageIds(prev =>
                                                    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                                )}
                                                markdownComponents={markdownComponents}
                                            />
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    )}

                    {isThinking && (
                        <div className="flex items-start gap-4 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="h-10 w-10 rounded-xl bg-gradient-study flex items-center justify-center text-white shadow-lg shadow-primary/20">AI</div>
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm tracking-tight text-primary">StudyFlow Tutor</span>
                                    <span className="text-[10px] text-primary/60 italic">({activeModel}) <span className="animate-pulse">is thinking...</span></span>
                                </div>
                                <div className="glass border border-primary/20 rounded-2xl rounded-tl-none p-4 w-fit flex gap-1.5 items-center bg-primary/5">
                                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {activeWorkspaceId && (
                    <ChatInput
                        workspaceId={activeWorkspaceId}
                        onSendMessage={handleSendMessage}
                        onYouTubeUrl={handleYouTubeUrl}
                        disabled={loading || isSummarizingYoutube}
                        isThinking={isThinking}
                        canMessageAI={currentUserPermission.can_message_ai}
                        chatMode={chatMode}
                    />
                )}
            </main>

            <AnimatePresence>
                {activeQuiz && (
                    <QuizView
                        quiz={activeQuiz}
                        onClose={() => setActiveQuiz(null)}
                    />
                )}
                {activeCards && (
                    <FlashcardView
                        cards={activeCards}
                        onClose={() => setActiveCards(null)}
                    />
                )}
                {activePreviewDoc && (
                    <DocumentPreview
                        document={activePreviewDoc}
                        onClose={() => setActivePreviewDoc(null)}
                    />
                )}
                {podcastUrl && (
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-xl pointer-events-none"
                    >
                        <div className="pointer-events-auto w-full px-4">
                            <PodcastPlayer
                                audioUrl={podcastUrl === "loading" ? "" : podcastUrl}
                                title={podcastTitle}
                                isGenerating={isGeneratingPodcast}
                                onClose={() => setPodcastUrl(null)}
                            />
                        </div>
                    </motion.div>
                )}
                {(isGeneratingQuiz || isGeneratingFlashcards || isSummarizingYoutube) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md"
                    >
                        <div className="text-center p-8 glass-dark border border-primary/30 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-300">
                            <div className="relative w-20 h-20 mx-auto mb-6">
                                <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                                <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center text-2xl">
                                    {isSummarizingYoutube ? "🎥" : "🧠"}
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">
                                {isSummarizingYoutube ? "Analyzing Video..." : "Generating Study Material..."}
                            </h3>
                            <p className="text-white/60 text-sm">
                                {isSummarizingYoutube
                                    ? "Our AI is extracting the transcript and crafting your summary. This takes about 30 seconds."
                                    : "AI is synthesizing your workspace documents into interactive tools."}
                            </p>
                        </div>
                    </motion.div>
                )}
                {isCallModeActive && activeWorkspaceId && (
                    <CallModeOverlay
                        workspaceId={activeWorkspaceId}
                        onClose={() => setIsCallModeActive(false)}
                        onMessageInjected={(msg) => setMessages(prev => [...prev, msg])}
                    />
                )}
            </AnimatePresence>

            {(isThinking || isGeneratingPodcast || isGeneratingQuiz || isGeneratingFlashcards || isCapturing) && (
                <div className="fixed inset-0 z-[200] pointer-events-none flex items-start justify-center pt-24">
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="glass px-6 py-3 rounded-full border border-primary/20 shadow-2xl flex items-center gap-3"
                    >
                        <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                        <span className="text-sm font-bold text-white tracking-wide">
                            {isCapturing ? "📸 Capturing diagrams..." :
                                isGeneratingQuiz ? "Generating Premium Quiz..." :
                                    isGeneratingFlashcards ? "Crafting Study Cards..." :
                                        isThinking ? `${activeModel} is thinking...` : "Synthesizing Audio..."}
                        </span>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
