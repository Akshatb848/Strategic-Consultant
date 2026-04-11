import type { Metadata } from "next";

import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "ASIS v4.0 - The Silicon Consultancy",
  description: "Autonomous Strategic Intelligence System for enterprise strategic decision support.",
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
