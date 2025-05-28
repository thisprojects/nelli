import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nelli",
  description: "Chat with local LLM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-full bg-gray-50">{children}</body>
    </html>
  );
}
