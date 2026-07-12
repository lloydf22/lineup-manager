import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import GlobalAssistant from "./components/GlobalAssistant";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lineup Manager Portal",
  description: "Root console for venue management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {/* Main layout contents rendered here */}
          {children}
          
          {/* Floating global full-suite assistant available on all viewports */}
          <GlobalAssistant />
        </AuthProvider>
      </body>
    </html>
  );
}