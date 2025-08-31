import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "./providers";
import Navigation from "@/components/Navigation";

export const metadata = { 
  title: "LexMind - Compliance AI Assistant", 
  description: "Professional compliance management with AI-powered insights",
  icons: {
    // Inline data URI to avoid favicon 404 during dev without adding binary assets
    icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='%231E40AF'/><text x='50%' y='56%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='34' fill='white'>L</text></svg>",
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full" suppressHydrationWarning>
        <Providers>
          <Navigation />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
