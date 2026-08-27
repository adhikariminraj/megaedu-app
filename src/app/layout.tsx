import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AuthSessionProvider from "@/components/AuthSessionProvider";

export const metadata: Metadata = {
  title: "MEGA.EDU — Education for Everyone",
  description:
    "A national education network connecting schools, teachers, students, parents and organizations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-mega-paper text-slate-800 min-h-screen flex flex-col">
        <AuthSessionProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
