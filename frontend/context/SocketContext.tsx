"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('studyflow_token');
        const userEmail = localStorage.getItem('studyflow_user_email');

        if (!token) {
            setIsConnected(false);
            setSocket(null);
            return;
        }

        // Connect to the backend socket server
        // Dynamically detect host for LAN/Tailscale support
        const socketHost = typeof window !== 'undefined' ? `http://${window.location.hostname}:8000` : 'http://localhost:8000';

        const socketInstance = io(socketHost, {
            path: '/socket.io',
            transports: ['websocket'],
            auth: { token }
        });

        socketInstance.on('connect', () => {
            setIsConnected(true);

            // Join a personal room named after the user's email for invites
            if (userEmail) {
                socketInstance.emit('join_room', { room: userEmail });
            }
        });

        socketInstance.on('disconnect', () => {
            setIsConnected(false);
        });

        socketInstance.on('new_invite', (data) => {
            alert(`You have been invited to workspace: ${data.workspace_title} by ${data.invited_by}`);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
