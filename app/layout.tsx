import "./style.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Ask ERI — Evidence from the ground",
  description:
    "Ask questions about ERI’s published, permissioned observations of the real economy.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
