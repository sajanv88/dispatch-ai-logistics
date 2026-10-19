import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@nuvui/react/styles.css";
import "@nuvui/map/styles.css";
import "@nuvui/barcodes/styles.css";
import "@nuvui/chat/styles.css";
import "@/styles/globals.scss";

export const metadata: Metadata = {
  title: "Dispatch",
  description:
    "An AI logistics console: talk to a Claude agent that re-plans a delivery van's round on a live map.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="system">
      <body>{children}</body>
    </html>
  );
}
