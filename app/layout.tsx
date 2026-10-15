import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Origyn | Central de operações",
  description: "Gestão de comentários e inteligência de atendimento. Demonstração privada.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
