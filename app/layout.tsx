import "./globals.css";

import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import Script from "next/script";

import { themeInitializerScript } from "@/shared/theme";
import { ThemeToggle } from "@/shared/ui/theme-toggle";

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage-grotesque",
  subsets: ["latin"],
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Campus by Rise",
  description:
    "A persistent digital campus for learning, collaboration, and community at Rise.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${instrumentSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Script id="theme-initializer" strategy="beforeInteractive">
          {themeInitializerScript}
        </Script>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
