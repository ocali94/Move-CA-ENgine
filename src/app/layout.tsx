import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeSync } from "@/components/theme-sync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Move CA Engine",
  description:
    "The front end of Move's funnel in one internal client acquisition app.",
  icons: {
    icon: "/move-favicon.png",
    apple: "/move-favicon.png",
  },
};

const themeBootstrap = `try{var t=localStorage.getItem("move-ca-theme")||"dark";document.documentElement.classList.toggle("light",t==="light");document.documentElement.classList.toggle("dark",t!=="light")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full text-ink">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
