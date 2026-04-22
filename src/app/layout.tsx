import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { Header } from "@/components/Header/Header";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Tau - A natural language interface for data visualization",
  description: "A demo by Brian Blakely.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body>
        <main className="flex flex-col h-screen px-6 pb-6 pt-8 w-full">
          <Header className="mb-8 mx-auto max-w-2xl w-full" />
          {children}
        </main>
      </body>
    </html>
  );
}
