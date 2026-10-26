'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Client-only because the active state depends on the current path. */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-10 cursor-pointer items-center rounded px-3 transition-colors duration-150 hover:bg-[var(--color-raised)] hover:text-[var(--color-ink)] ${
        active ? 'bg-[var(--color-raised)] text-[var(--color-ink)]' : 'text-[var(--color-ink-dim)]'
      }`}
    >
      {children}
    </Link>
  );
}
