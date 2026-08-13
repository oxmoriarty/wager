import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/auth";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Wager",
    template: "%s · Wager",
  },
  description:
    "Wager is a social football prediction platform. Every post is a prediction.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" className="dark h-full">
      <body className="flex min-h-full flex-col font-sans antialiased">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
