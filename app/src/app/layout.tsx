import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { SmoothScroll } from "@/components/block/smooth-scroll";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL("http://127.0.0.1:3000"),
  title: "Sable — Trust scores for AI agents",
  description:
    "The credit bureau for AI agents. Deterministic reputation scores from onchain escrow history — one-call trust check before you pay an agent.",
  icons: {
    icon: [{ url: "/logo-brand/logo.webp", type: "image/webp" }],
    apple: "/logo-brand/logo.webp",
  },
  openGraph: {
    title: "Sable — Trust scores for AI agents",
    description:
      "Onchain credit bureau for AI agents. Deterministic scores 0–1000 from escrow history.",
    images: [
      {
        url: "/logo-brand/brandkit.webp",
        width: 1760,
        height: 990,
        alt: "Sable — onchain credit bureau for AI agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sable — Trust scores for AI agents",
    description: "Onchain credit bureau for AI agents. Score 0–1000, recomputable by anyone.",
    images: ["/logo-brand/brandkit.webp"],
  },
};

function Mark() {
  return (
    <Image
      src="/logo-brand/logo.webp"
      alt=""
      width={28}
      height={28}
      className="size-7 rounded-lg"
      priority
    />
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(11,13,18,0.75)] backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Sable home">
              <Mark />
              <span className="text-[17px] font-extrabold tracking-tight">Sable</span>
              <span className="mono hidden rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-px text-[10px] uppercase tracking-widest text-accent sm:inline">
                beta
              </span>
            </Link>
            <Nav />
            <div className="mono ml-auto hidden items-center gap-2 text-xs text-[var(--muted)] md:flex">
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-[var(--accent-from)]" />
              deterministic scoring · recompute it yourself
            </div>
          </div>
        </header>

        <SmoothScroll>
          <main id="main">{children}</main>
          <footer className="border-t border-[var(--line)]">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-xs leading-relaxed text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Every Sable score is a pure function of onchain events — recompute with{" "}
                <span className="mono text-neutral-500">npm run recompute</span>.
              </p>
              <nav className="flex gap-4" aria-label="Footer">
                <Link href="/leaderboard" className="transition-colors hover:text-purple-400">
                  Leaderboard
                </Link>
                <Link href="/explorer" className="transition-colors hover:text-purple-400">
                  Explorer
                </Link>
                <Link href="/demo" className="transition-colors hover:text-purple-400">
                  Demo
                </Link>
              </nav>
            </div>
          </footer>
        </SmoothScroll>
      </body>
    </html>
  );
}
