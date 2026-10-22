import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuardianGate",
  description: "Policy-enforced pediatric record access prototype",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
