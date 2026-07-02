"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Clock, DollarSign, GitBranch, House, Menu, Settings2, X } from "lucide";
import { LucideIcon } from "@/components/ui/lucide-icon";
import styles from "./dashboard-shell.module.css";

type DashboardNavItem = {
  href: string;
  title: string;
  meta: string;
  icon: typeof House;
  soon?: boolean;
};

const primaryNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    title: "Agent Dashboard",
    meta: "Default board",
    icon: House,
  },
  {
    href: "/dashboard/timeline",
    title: "Live Activity Timeline",
    meta: "Recent 6 actions",
    icon: Clock,
  },
  {
    href: "/dashboard/github-action",
    title: "Github Action",
    meta: "Coming soon",
    icon: GitBranch,
    soon: true,
  },
  {
    href: "/dashboard/policy-config",
    title: "Policy Config",
    meta: "Coming soon",
    icon: Settings2,
    soon: true,
  },
  {
    href: "/dashboard/pricing",
    title: "Pricing",
    meta: "Coming soon",
    icon: DollarSign,
    soon: true,
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.mobileHeader}>
          <div className={styles.mobileHeaderCopy}>
            <Link className={styles.logoLink} href="/" aria-label="Sigillum home" onClick={() => setNavOpen(false)}>
              <Image
                src="/images/Untitled design (15).webp"
                alt=""
                aria-hidden="true"
                width={32}
                height={32}
                className={styles.logoIcon}
                priority
              />
              Sigillum
            </Link>
            <span className={styles.mobileMeta}>Dashboard shell</span>
          </div>
          <button
            aria-controls="dashboard-nav"
            aria-expanded={navOpen}
            aria-label={navOpen ? "Close dashboard navigation" : "Open dashboard navigation"}
            className={styles.menuButton}
            onClick={() => setNavOpen((open) => !open)}
            type="button"
          >
            <LucideIcon icon={navOpen ? X : Menu} label={navOpen ? "Close menu" : "Open menu"} size={20} />
          </button>
        </header>

        {navOpen ? (
          <button
            aria-label="Close dashboard navigation"
            className={styles.mobileBackdrop}
            onClick={() => setNavOpen(false)}
            type="button"
          />
        ) : null}

        <aside className={`${styles.rail} ${navOpen ? styles.railOpen : ""}`}>
          <div className={styles.railHeader}>
            <Link className={styles.logoLink} href="/" aria-label="Sigillum home">
              <Image
                src="/images/Untitled design (15).webp"
                alt=""
                aria-hidden="true"
                width={32}
                height={32}
                className={styles.logoIcon}
                priority
              />
              <span className={styles.logoWordmark}>Sigillum</span>
            </Link>
            <p className={styles.railEyebrow}>Proof board shell</p>
            <p className={styles.railCopy}>
              Live persisted agent activity, payment proof, and receipt outcomes.
            </p>
          </div>

          <nav
            className={`${styles.nav} ${navOpen ? styles.navOpen : ""}`}
            id="dashboard-nav"
            aria-label="Dashboard navigation"
          >
            <div className={styles.navSection}>
              {primaryNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
                    href={item.href}
                    key={item.href}
                    onClick={() => setNavOpen(false)}
                    title={item.title}
                  >
                    <span className={styles.navIcon} aria-hidden="true">
                      <LucideIcon icon={item.icon} size={18} />
                    </span>
                    <span className={styles.navLabel}>
                      <span className={styles.navTitle}>{item.title}</span>
                      <span className={styles.navMeta}>{item.meta}</span>
                    </span>
                    <span className={styles.navTooltip} role="presentation">
                      {item.title}
                    </span>
                    {item.soon ? <span className={styles.soonBadge}>Soon</span> : null}
                  </Link>
                );
              })}
            </div>

            <div className={styles.railFooter}>
              <Link className={styles.navButtonLike} href="/" onClick={() => setNavOpen(false)} title="Go back">
                <span className={styles.navIcon} aria-hidden="true">
                  <LucideIcon icon={ArrowLeft} size={18} />
                </span>
                <span className={styles.navLabel}>
                  <span className={styles.navTitle}>Go back</span>
                  <span className={styles.navMeta}>Return to landing page</span>
                </span>
                <span className={styles.navTooltip} role="presentation">
                  Go back
                </span>
              </Link>
            </div>
          </nav>
        </aside>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
