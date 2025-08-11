import type { Metadata } from "next";
import "./globals.css";

import { DM_Mono } from "next/font/google";

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mechaverse",
  description:
    "Mechaverse is a Placeholder project allowing you to upload your own robot and view it in a 3D environment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`min-h-screen bg-background text-foreground ${dmMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
