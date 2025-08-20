import "./globals.css";
import { ReactNode } from "react";
import SplashScreen from "../components/SplashScreen";
import AuthWrapper from "../components/AuthWrapper";

export const metadata = { 
  title: "LexMind - Compliance AI Assistant", 
  description: "Professional compliance management with AI-powered insights" 
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        <SplashScreen />
        <AuthWrapper>
          <div className="container-page">
            {children}
          </div>
        </AuthWrapper>
      </body>
    </html>
  );
}
