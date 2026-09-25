import "./globals.css";

import type { Metadata } from "next";
import Script from "next/script";

import { fontVariableClasses } from "@/shared/styles/fonts";
import { themeInitializerScript } from "@/shared/theme";
import { ThemeToggle } from "@/shared/ui/theme-toggle";

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
      data-scroll-behavior="smooth"
      className={`${fontVariableClasses} h-full font-sans antialiased`}
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
