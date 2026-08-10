import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { NebulaBackground } from "@/components/NebulaBackground";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300"],
  variable: "--font-newsreader",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Quote Poster Dashboard",
  description: "Manage accounts, categories, templates, and posting history.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <NebulaBackground />
        <div className="relative z-[1]">{children}</div>
      </body>
    </html>
  );
}
