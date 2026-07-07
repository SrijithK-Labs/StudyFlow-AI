export const getBaseApiUrl = () => {
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        return `http://${hostname}:8000`;
    }
    return 'http://localhost:8000';
};

export const API_URL = getBaseApiUrl(); // For backward compatibility where safe

function getHeaders(isFormData = false) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('studyflow_token') : '';
    const headers: any = {
        'Authorization': token ? `Bearer ${token}` : ''
    };
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

export async function fetchWorkspaces() {
    const res = await fetch(`${API_URL}/api/v1/workspaces/`, {
        headers: getHeaders()
    });
    if (!res.ok) {
        const errorText = await res.text();
        console.error(`API Error (${res.status}): ${errorText}`);
        throw new Error(`Failed to fetch workspaces: ${res.status} ${errorText || ''}`);
    }
    return res.json();
}

export async function fetchMessages(workspaceId: string) {
    const res = await fetch(`${API_URL}/api/v1/chat/${workspaceId}/messages`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch messages');
    return res.json();
}


export async function createWorkspace(title: string) {
    const response = await fetch(`${API_URL}/api/v1/workspaces/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ title }),
    });
    if (!response.ok) {
        let errorMsg = 'Failed to create workspace';
        try {
            const errorData = await response.json();
            errorMsg = errorData.detail || errorMsg;
        } catch (e) {
            // If not JSON, try text
            errorMsg = await response.text().catch(() => errorMsg);
        }
        console.error("Workspace creation failed:", errorMsg);
        throw new Error(errorMsg);
    }
    return response.json();
}

export async function saveMessage(workspaceId: string, message: { sender: string, sender_type: string, content: string, mermaid_code?: string }) {
    const response = await fetch(`${API_URL}/api/v1/chat/${workspaceId}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(message),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Save message failed:", errorData);
        throw new Error(errorData.detail || 'Failed to save message');
    }
    return response.json();
}

export async function askAI(workspaceId: string, content: string, isVoice: boolean = false) {
    const response = await fetch(`${API_URL}/api/v1/chat/${workspaceId}/ask`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ sender: 'You', sender_type: 'user', content, request_audio: isVoice }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to get AI response');
    }
    return response.json();
}

export async function uploadDocument(workspaceId: string, file: File) {
    const formData = new FormData();
    formData.append('workspace_id', workspaceId);
    formData.append('file', file);

    const res = await fetch(`${API_URL}/api/v1/documents/upload`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
    });

    if (!res.ok) {
        let errorDetail = 'Failed to upload document';
        try {
            const errorJson = await res.json();
            errorDetail = errorJson.detail || errorDetail;
        } catch (e) { }
        throw new Error(errorDetail);
    }
    return res.json();
}

export async function processYouTubeUrl(workspaceId: string, url: string) {
    const formData = new FormData();
    formData.append('workspace_id', workspaceId);
    formData.append('url', url);

    const res = await fetch(`${API_URL}/api/v1/documents/youtube`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to process YouTube URL');
    }
    return res.json();
}

export async function fetchDocuments(workspaceId: string) {
    const res = await fetch(`${API_URL}/api/v1/documents/${workspaceId}`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
}

export async function deleteWorkspace(workspaceId: string) {
    const res = await fetch(`${API_URL}/api/v1/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete workspace');
    return res.json();
}

export async function deleteDocument(documentId: string) {
    const res = await fetch(`${API_URL}/api/v1/documents/${documentId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete document');
    return res.json();
}

export async function fetchMemberMessages(workspaceId: string) {
    const res = await fetch(`${API_URL}/api/v1/chat/${workspaceId}/member-messages`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch member messages');
    return res.json();
}

export async function sendMemberMessage(workspaceId: string, content: string) {
    const response = await fetch(`${API_URL}/api/v1/chat/${workspaceId}/member-messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to send message');
    }
    return response.json();
}
export async function generatePodcast(workspaceId: string, messageIds?: string[]) {
    const response = await fetch(`${API_URL}/api/v1/ai/workspaces/${workspaceId}/podcast`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message_ids: messageIds })
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to generate podcast');
    }
    return response.json();
}
export async function deletePodcast(workspaceId: string, podcastId: string) {
    const response = await fetch(`${API_URL}/api/v1/ai/workspaces/${workspaceId}/podcasts/${podcastId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete podcast');
    }
    return response.json();
}
export async function fetchActiveModel() {
    const res = await fetch(`${API_URL}/api/v1/ai/active-model`, {
        headers: getHeaders()
    });
    if (!res.ok) return { model_name: "AI Tutor" };
    return res.json();
}

// Educational Tools
export async function generateQuiz(workspaceId: string, documentIds?: string[], count: number = 5) {
    const response = await fetch(`${API_URL}/api/v1/educational/workspaces/${workspaceId}/quiz/generate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ document_ids: documentIds, count })
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to generate quiz');
    }
    return response.json();
}

export async function fetchQuizzes(workspaceId: string) {
    const res = await fetch(`${API_URL}/api/v1/educational/workspaces/${workspaceId}/quizzes`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch quizzes');
    return res.json();
}

export async function generateFlashcards(workspaceId: string, documentIds?: string[], count: number = 8) {
    const response = await fetch(`${API_URL}/api/v1/educational/workspaces/${workspaceId}/flashcards/generate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ document_ids: documentIds, count })
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to generate flashcards');
    }
    return response.json();
}

export async function fetchFlashcards(workspaceId: string) {
    const res = await fetch(`${API_URL}/api/v1/educational/workspaces/${workspaceId}/flashcards`, {
        headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch flashcards');
    return res.json();
}

export async function transcribeVoice(workspaceId: string, audioBlob: Blob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const res = await fetch(`${API_URL}/api/v1/chat/${workspaceId}/transcribe`, {
        method: 'POST',
        headers: getHeaders(true),
        body: formData,
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to transcribe audio');
    }
    return res.json();
}
