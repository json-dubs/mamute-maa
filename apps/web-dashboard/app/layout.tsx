import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mamute MAA Dashboard",
  description: "Front desk check-in and admin tools"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="app-shell">{children}</body>
    </html>
  );
}
