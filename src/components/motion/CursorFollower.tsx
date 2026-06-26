"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { usePathname } from "next/navigation";

const reduceMotionQuery = "(prefers-reduced-motion: reduce)";
const finePointerQuery = "(hover: hover) and (pointer: fine)";

export function CursorFollower() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    const reduceMotion = window.matchMedia(reduceMotionQuery);
    const finePointer = window.matchMedia(finePointerQuery);

    if (reduceMotion.matches || !finePointer.matches) {
      cursor.setAttribute("hidden", "");
      return;
    }

    cursor.removeAttribute("hidden");

    const quickX = gsap.quickTo(cursor, "x", {
      duration: 0.36,
      ease: "power3.out",
    });
    const quickY = gsap.quickTo(cursor, "y", {
      duration: 0.36,
      ease: "power3.out",
    });
    const widthTo = gsap.quickTo(cursor, "width", {
      duration: 0.22,
      ease: "power2.out",
    });
    const heightTo = gsap.quickTo(cursor, "height", {
      duration: 0.22,
      ease: "power2.out",
    });
    const opacityTo = gsap.quickTo(cursor, "opacity", {
      duration: 0.18,
      ease: "power2.out",
    });

    gsap.set(cursor, {
      opacity: 0,
      width: 24,
      height: 24,
      xPercent: -50,
      yPercent: -50,
    });

    const moveCursor = (event: PointerEvent) => {
      quickX(event.clientX);
      quickY(event.clientY);
      opacityTo(1);
    };

    const leaveWindow = () => opacityTo(0);
    const enterTarget = () => {
      cursor.classList.add("cursor-follower--active");
      widthTo(48);
      heightTo(48);
    };
    const leaveTarget = () => {
      cursor.classList.remove("cursor-follower--active");
      widthTo(28);
      heightTo(28);
    };

    const interactiveTargets = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-hover-card], a, button, label, input, textarea, select",
      ),
    );

    window.addEventListener("pointermove", moveCursor, { passive: true });
    document.addEventListener("pointerleave", leaveWindow);
    interactiveTargets.forEach((target) => {
      target.addEventListener("pointerenter", enterTarget);
      target.addEventListener("pointerleave", leaveTarget);
    });

    return () => {
      window.removeEventListener("pointermove", moveCursor);
      document.removeEventListener("pointerleave", leaveWindow);
      interactiveTargets.forEach((target) => {
        target.removeEventListener("pointerenter", enterTarget);
        target.removeEventListener("pointerleave", leaveTarget);
      });
    };
  }, [pathname]);

  return (
    <div
      ref={cursorRef}
      className="cursor-follower"
      aria-hidden="true"
      data-motion-runtime="cursor-follower"
      hidden
    />
  );
}
