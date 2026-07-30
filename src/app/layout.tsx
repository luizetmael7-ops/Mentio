import type { Metadata } from "next";
import { Archivo, Inter, Space_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsProvider } from "./providers";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://mentio.fr"),
  title: "Mentio — la perception, mesurée.",
  description:
    "Mentio mesure la présence de votre marque dans les réponses de ChatGPT, Gemini, Claude et Perplexity — face à vos concurrents, modèle par modèle, semaine après semaine.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Mentio",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${archivo.variable} ${inter.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AnalyticsProvider>{children}</AnalyticsProvider>
        <Toaster />
      </body>
    </html>
  );
}
