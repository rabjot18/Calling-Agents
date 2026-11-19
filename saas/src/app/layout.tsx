import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/motion";

// One workhorse family; its width axis gives the narrow "printed diary" cut for dates and hours.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "Pulse, your AI receptionist",
  description: "An AI receptionist that answers every call, takes bookings and messages, and writes each call into your day.",
};
export const viewport: Viewport = { themeColor: "#1d3a30" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
