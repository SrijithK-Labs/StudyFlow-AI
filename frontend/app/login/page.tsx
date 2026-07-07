"use client";

import { useRouter } from "next/navigation";
import { getBaseApiUrl } from "@/services/api";

export default function LoginPage() {
	const router = useRouter();

	const handleGoogleLogin = () => {
		// Redirect to backend Google login endpoint dynamically
		const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
		window.location.href = `${getBaseApiUrl()}/api/v1/auth/login?origin=${encodeURIComponent(origin)}`;
	};

	return (
		<div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#050505] selection:bg-primary/30">
			{/* Premium Background Elements */}
			<div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
				<div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[160px] animate-pulse" />
				<div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[160px] animate-pulse" style={{ animationDelay: "3s" }} />
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]" />
			</div>

			{/* CSS Grain Pattern overlay (replaced external SVG for speed) */}
			<div className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none"
				style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0%200%20200%20200'%20xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter%20id='noiseFilter'%3E%3CfeTurbulence%20type='fractalNoise'%20baseFrequency='0.65'%20numOctaves='3'%20stitchTiles='stitch'/%3E%3C/filter%3E%3Crect%20width='100%25'%20height='100%25'%20filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

			<div className="w-full max-w-xl p-6 md:p-8 z-10 flex flex-col items-center">
				{/* Logo Section */}
				<div className="mb-8 md:mb-12 text-center animate-slide-up">
					<div className="relative inline-block mb-6 group">
						<div className="absolute inset-0 bg-primary/40 rounded-3xl blur-2xl group-hover:bg-primary/60 transition-all duration-500" />
						<div className="relative h-20 w-20 md:h-24 md:w-24 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 shadow-2xl overflow-hidden group-hover:border-primary/50 transition-colors">
							<img src="/asset/Logo.png" alt="StudyFlow Logo" className="w-12 h-12 md:w-16 md:h-16 object-contain" />
						</div>
					</div>

					<h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white mb-4">
						StudyFlow <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">AI</span>
					</h1>
					<p className="text-base md:text-lg text-foreground/60 max-w-sm mx-auto leading-relaxed">
						Revolutionize your learning with real-time collaboration and intelligent AI assistance.
					</p>
				</div>

				{/* Action Card */}
				<div className="w-full glass-dark border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] animate-fade-in relative overflow-hidden group">
					<div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/20 transition-all duration-700" />

					<div className="relative z-10 text-center">
						<h2 className="text-xl md:text-2xl font-bold mb-6 md:mb-8 text-white/90">Sign in to start your journey</h2>

						<button
							onClick={handleGoogleLogin}
							className="w-full flex items-center justify-center gap-4 bg-white text-black font-bold py-4 md:py-5 rounded-2xl shadow-xl hover:bg-zinc-100 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 relative overflow-hidden"
						>
							<svg className="w-6 h-6" viewBox="0 0 24 24">
								<path
									fill="#4285F4"
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								/>
								<path
									fill="#34A853"
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								/>
								<path
									fill="#FBBC05"
									d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
								/>
								<path
									fill="#EA4335"
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
								/>
							</svg>
							<span>Continue with Google</span>
						</button>

						<div className="mt-8 flex flex-col gap-4">
							<div className="flex items-center justify-center gap-6 opacity-40">
								<div className="h-[1px] flex-1 bg-white/20" />
								<span className="text-[10px] uppercase tracking-[3px] font-bold">Secure Login</span>
								<div className="h-[1px] flex-1 bg-white/20" />
							</div>

							<p className="text-[11px] text-foreground/40 leading-loose">
								By signing in, you agree to our <span className="text-white/60 hover:text-primary cursor-pointer transition-colors">Terms of Service</span> and <span className="text-white/60 hover:text-primary cursor-pointer transition-colors">Privacy Policy</span>.
							</p>
						</div>
					</div>
				</div>

				{/* Floating Badges */}
				<div className="mt-8 md:mt-12 flex flex-wrap justify-center gap-3 md:gap-4 animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
					<div className="px-4 py-2 rounded-full glass border border-white/5 text-[10px] font-bold text-foreground/50 tracking-widest uppercase flex items-center gap-2">
						<span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
						Infrastructure Online
					</div>
					<div className="px-4 py-2 rounded-full glass border border-white/5 text-[10px] font-bold text-foreground/50 tracking-widest uppercase flex items-center gap-2">
						⚡ Groq Powered
					</div>
				</div>
			</div>
		</div>
	);
}
