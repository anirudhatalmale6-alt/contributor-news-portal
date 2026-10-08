import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { RouteProgress } from "@/components/route-progress";
import { primeUiText } from "@/lib/ui-text-store";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The owner's own wording, loaded before anything below it renders. t() is
  // called from components that cannot await, so this is where it has to happen.
  await primeUiText();

  return (
    <html lang="en">
      <body>
        {/* Reads the query string, so it needs its own boundary. */}
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
