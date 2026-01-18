import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { MarkdownAlternate } from "@/components/MarkdownAlternate";

export const metadata: Metadata = {
  title: "Best Wishes",
  description: "AI-powered greeting card generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          <MarkdownAlternate />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
