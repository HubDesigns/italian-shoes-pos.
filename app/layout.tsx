import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Italian Shoes | Retail Management",
  description: "Multi-branch footwear retail management system.",
  applicationName: "Italian Shoes",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
