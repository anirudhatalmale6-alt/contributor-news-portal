import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3300"),
  title: {
    default: "The Document - contributor-powered news",
    template: "%s | The Document",
  },
  description:
    "An independent newsroom written by its readers. Every piece is checked by an editor before it goes live.",
  openGraph: { type: "website", siteName: "The Document" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
