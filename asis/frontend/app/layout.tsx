import type { Metadata } from "next";

import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "ASIS v4.0 Gold - Strategic Decision Intelligence",
  description: "Autonomous Strategic Intelligence System for board-ready strategic decisions, framework-driven analysis, and enterprise report generation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
