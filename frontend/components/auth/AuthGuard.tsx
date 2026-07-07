"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("studyflow_token");
        if (!token) {
            router.push("/login"); // Adjust to your login route
        } else {
            setIsAuthenticated(true);
        }
    }, [router]);

    if (isAuthenticated === null) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-foreground/60 font-medium tracking-tight">Verifying your session...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
