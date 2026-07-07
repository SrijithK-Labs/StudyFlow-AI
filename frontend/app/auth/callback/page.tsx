"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const token = searchParams.get("token");
        const name = searchParams.get("name");
        const email = searchParams.get("email");
        const picture = searchParams.get("picture");

        if (token) {
            localStorage.setItem("studyflow_token", token);
            if (name) localStorage.setItem("studyflow_user_name", name);
            if (email) localStorage.setItem("studyflow_user_email", email);
            if (picture) localStorage.setItem("studyflow_user_picture", picture);
            router.push("/chat");
        } else {
            router.push("/login?error=auth_failed");
        }
    }, [router, searchParams]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background">
            <div className="h-12 w-12 rounded-xl bg-primary animate-spin mb-4" />
            <p className="text-foreground/50 animate-pulse">Completing authentication...</p>
        </div>
    );
}

export default function AuthCallback() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex flex-col items-center justify-center bg-background">
                <div className="h-12 w-12 rounded-xl bg-primary animate-spin mb-4" />
                <p className="text-foreground/50 animate-pulse">Loading...</p>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}
