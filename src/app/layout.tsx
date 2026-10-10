import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito } from "next/font/google";
import { ParentSessionProvider } from "@/components/ParentSession";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["SOFT", "opsz"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Haagie Headquarters",
  description: "The Haagenson family command center.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f2ea",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${nunito.variable} antialiased`}>
        <ParentSessionProvider>{children}</ParentSessionProvider>
      </body>
    </html>
  );
}
