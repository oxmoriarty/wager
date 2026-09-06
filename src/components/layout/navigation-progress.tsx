"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // When pathname or searchParams change, the navigation has completed
  useEffect(() => {
    if (loading) {
      setProgress(100);
      const timer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (loading && progress < 85) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 80) return prev;
          const inc = Math.max(1, (80 - prev) * 0.2);
          return Math.min(80, prev + inc);
        });
      }, 100);
    }

    return () => clearInterval(interval);
  }, [loading, progress]);

  // Global click interceptor for internal links
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // Find nearest anchor tag
      const target = (e.target as HTMLElement)?.closest?.("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore external links, downloads, new tabs, hashes
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#") ||
        target.target === "_blank" ||
        target.hasAttribute("download") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      // Check if it's pointing to the exact current URL
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (href === currentUrl) return;

      // Start loading bar immediately
      setLoading(true);
      setProgress(25);
    }

    function handleStartNav() {
      setLoading(true);
      setProgress(25);
    }

    function handleDoneNav() {
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 200);
    }

    window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("wager:nav_start", handleStartNav);
    window.addEventListener("wager:nav_done", handleDoneNav);

    return () => {
      window.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("wager:nav_start", handleStartNav);
      window.removeEventListener("wager:nav_done", handleDoneNav);
    };
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none h-[2.5px] bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-emerald-500 via-primary to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)] transition-all duration-150 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transitionDuration: progress === 100 ? "200ms" : "150ms",
        }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  );
}
