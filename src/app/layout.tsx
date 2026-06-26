import type { Metadata } from "next";
import { CardHoverTilt } from "@/components/motion/CardHoverTilt";
import { CursorFollower } from "@/components/motion/CursorFollower";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sigillum | Proof before permission",
  description:
    "Sigillum gives AI coding agents paid risk receipts before merge, deploy, install, or publish.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CursorFollower />
        <CardHoverTilt />
        {children}
      </body>
    </html>
  );
}
