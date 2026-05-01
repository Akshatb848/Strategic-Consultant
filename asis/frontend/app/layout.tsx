import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair-display",
  display: "swap",
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "ASIS v4.0 — Strategic Intelligence",
  description:
    "Autonomous Strategic Intelligence System for board-ready strategic decisions, framework-driven analysis, and enterprise report generation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${playfairDisplay.variable}`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
