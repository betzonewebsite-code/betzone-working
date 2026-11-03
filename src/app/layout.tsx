import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import LiveOddsBridge from "@/components/match/LiveOddsBridge";
import AuthBootstrap from "@/components/auth/AuthBootstrap";
import AuthModal from "@/components/auth/AuthModal";
import Header from "@/components/layout/Header";
import NavBar from "@/components/layout/NavBar";
import BottomNav from "@/components/layout/BottomNav";
import MobileSlipSheet from "@/components/layout/MobileSlipSheet";

export const metadata: Metadata = { title: "BetZone", description: "Sports betting" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#E30613" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LiveOddsBridge />
        <AuthBootstrap />
        <div className="sticky top-0 z-40">
          <Header />
          <NavBar />
        </div>
        <div className="pb-24 lg:pb-0">{children}</div>
        <BottomNav />
        <MobileSlipSheet />
        <AuthModal />
      </body>
    </html>
  );
}
