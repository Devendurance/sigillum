"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { usePathname } from "next/navigation";

const reduceMotionQuery = "(prefers-reduced-motion: reduce)";
const finePointerQuery = "(hover: hover) and (pointer: fine)";
const hoverSelector = "[data-hover-card]";

export function CardHoverTilt() {
  const pathname = usePathname();

  useEffect(() => {
    const reduceMotion = window.matchMedia(reduceMotionQuery);
    const finePointer = window.matchMedia(finePointerQuery);

    if (reduceMotion.matches || !finePointer.matches) {
      return;
    }

    const cards = Array.from(document.querySelectorAll<HTMLElement>(hoverSelector));
    if (!cards.length) return;

    const cleanups = cards.map((card) => {
      const baseRotation = Number(card.dataset.baseRotate ?? 0);
      const baseX = Number(card.dataset.baseX ?? 0);
      const lift = Number(card.dataset.hoverLift ?? 10);
      const maxTilt = Number(card.dataset.hoverTilt ?? 4.5);
      let bounds: DOMRect | null = null;

      gsap.set(card, {
        x: baseX,
        rotation: baseRotation,
        rotationX: 0,
        rotationY: 0,
        z: 0,
        transformPerspective: 900,
        transformOrigin: "50% 50%",
        backfaceVisibility: "hidden",
      });

      const enterCard = () => {
        bounds = card.getBoundingClientRect();
        card.classList.add("is-hovering-card");
        gsap.to(card, {
          y: -lift,
          z: 16,
          duration: 0.28,
          ease: "power3.out",
          overwrite: "auto",
        });
      };

      const moveCard = (event: PointerEvent) => {
        if (!bounds) return;

        const relativeX = (event.clientX - bounds.left) / bounds.width - 0.5;
        const relativeY = (event.clientY - bounds.top) / bounds.height - 0.5;

        gsap.to(card, {
          rotationY: relativeX * maxTilt,
          rotationX: relativeY * -maxTilt,
          rotation: baseRotation + relativeX * 1.2,
          x: baseX + relativeX * 3,
          duration: 0.22,
          ease: "power2.out",
          overwrite: "auto",
        });
      };

      const leaveCard = () => {
        bounds = null;
        card.classList.remove("is-hovering-card");
        gsap.to(card, {
            x: baseX,
            y: 0,
            z: 0,
            rotationX: 0,
          rotationY: 0,
          rotation: baseRotation,
          duration: 0.42,
          ease: "elastic.out(1, 0.72)",
          overwrite: "auto",
        });
      };

      card.addEventListener("pointerenter", enterCard);
      card.addEventListener("pointermove", moveCard);
      card.addEventListener("pointerleave", leaveCard);

      return () => {
        card.removeEventListener("pointerenter", enterCard);
        card.removeEventListener("pointermove", moveCard);
        card.removeEventListener("pointerleave", leaveCard);
        gsap.killTweensOf(card);
      };
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [pathname]);

  return <span data-motion-runtime="card-hover-tilt" hidden />;
}
