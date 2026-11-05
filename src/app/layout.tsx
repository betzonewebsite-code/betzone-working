import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import LiveOddsBridge from "@/components/match/LiveOddsBridge";
import AuthBootstrap from "@/components/auth/AuthBootstrap";
import AuthModal from "@/components/auth/AuthModal";
import RouteChrome from "@/components/layout/RouteChrome";
import MobileSlipSheet from "@/components/layout/MobileSlipSheet";

export const metadata: Metadata = {
  title: "BetZone",
  description: "Sports betting",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#E30613",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen overflow-x-hidden bg-[#E9EDF0] text-base antialiased">
        <LiveOddsBridge />
        <AuthBootstrap />

        <RouteChrome />

        <div className="mx-auto min-h-screen w-full overflow-x-hidden rounded-t-[18px] bg-[var(--canvas)] pb-20 lg:rounded-t-[22px] lg:pb-0">
          {children}
        </div>

        <MobileSlipSheet />
        <AuthModal />
      </body>
    </html>
  );
}
