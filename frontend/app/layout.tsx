import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StudyFlow AI | Collaborative AI Workspace",
  description: "Real-time team collaboration, AI-assisted documentation, and smart study material management.",
  icons: {
    icon: "/asset/Logo.png",
    shortcut: "/asset/Logo.png",
    apple: "/asset/Logo.png",
  }
};

import { SocketProvider } from "@/context/SocketContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground transition-colors duration-300"
        suppressHydrationWarning
      >
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}
