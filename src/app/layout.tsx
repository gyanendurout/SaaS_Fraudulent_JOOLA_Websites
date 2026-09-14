import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'JOOLA Brand Protection',
  description: 'Impersonation domain discovery, investigation and takedown evidence.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--color-info)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--color-void)]"
        >
          Skip to main content
        </a>

        <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-void)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
            <Link href="/" className="group flex items-baseline gap-2.5">
              <span className="mono text-[15px] font-bold tracking-tight text-[var(--color-ink)]">
                JOOLA
              </span>
              <span className="mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)] transition-colors group-hover:text-[var(--color-ink-dim)]">
                Brand Protection
              </span>
            </Link>

            <nav aria-label="Main" className="flex items-center gap-1 text-[13px]">
              <NavLink href="/">Overview</NavLink>
              <NavLink href="/domains">Domains</NavLink>
              <NavLink href="/cluster/joola-impersonation-2026-07">Campaign</NavLink>
            </nav>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-6">
          {children}
        </main>

        <footer className="border-t border-[var(--color-line)] px-4 py-6 sm:px-6">
          <p className="mx-auto max-w-[1400px] text-[11px] leading-relaxed text-[var(--color-ink-faint)]">
            Internal brand-protection tooling. Findings are evidence-based risk indicators, not
            legal determinations. Only domains with transactional evidence are recorded as confirmed
            fraud.
          </p>
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="cursor-pointer rounded px-2.5 py-1.5 text-[var(--color-ink-dim)] transition-colors duration-150 hover:bg-[var(--color-raised)] hover:text-[var(--color-ink)]"
    >
      {children}
    </Link>
  );
}
