"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export function ScrollChoreography() {
  useEffect(() => {
    if (window.matchMedia(reducedMotionQuery).matches) {
      document.documentElement.classList.add("reduced-motion");
      document.documentElement.classList.remove("motion-ready");
      return;
    }

    document.documentElement.classList.add("motion-ready");

    return () => {
      document.documentElement.classList.remove("motion-ready");
    };
  }, []);

  useGSAP(() => {
    if (typeof window === "undefined") return;

    const reduceMotion = window.matchMedia(reducedMotionQuery);

    if (reduceMotion.matches) {
      gsap.set("[data-motion]", { clearProps: "transform,opacity,visibility" });
      return;
    }

    const root = document.querySelector<HTMLElement>("[data-motion-root]");
    if (!root) return;

    const selector = gsap.utils.selector(root);
    const boards = selector("[data-motion='board-section']");
    const flowCards = selector("[data-motion='flow-card']");
    const checkCards = selector("[data-motion='check-card']");
    const splitLeft = selector("[data-motion='split-left']");
    const splitRight = selector("[data-motion='split-right']");
    const finalCard = selector("[data-motion='final-card']");
    const heroCopy = selector("[data-motion='hero-copy']");
    const heroArtifacts = selector("[data-motion='hero-artifact']");
    const proofPills = selector("[data-motion='proof-pill']");

    gsap.set([...boards, ...flowCards, ...checkCards, ...splitLeft, ...splitRight, ...finalCard], {
      opacity: 0,
      visibility: "hidden",
      y: 44,
    });
    gsap.set(heroCopy, { opacity: 0, visibility: "hidden", y: 28 });
    gsap.set(heroArtifacts, { opacity: 0, visibility: "hidden", y: 36 });
    gsap.set(proofPills, { opacity: 0, visibility: "hidden", y: 12 });

    gsap
      .timeline({ defaults: { ease: "power3.out" } })
      .to(heroCopy, {
        opacity: 1,
        visibility: "visible",
        y: 0,
        duration: 0.8,
        stagger: 0.08,
      })
      .to(
        heroArtifacts,
        {
          opacity: 1,
          visibility: "visible",
          y: 0,
          duration: 0.9,
          stagger: 0.12,
        },
        "-=0.42",
      )
      .to(
        proofPills,
        {
          opacity: 1,
          visibility: "visible",
          y: 0,
          duration: 0.5,
          stagger: 0.04,
        },
        "-=0.52",
      );

    boards.forEach((board) => {
      const copy = board.querySelectorAll("[data-motion='section-copy'] > *");
      const content = board.querySelectorAll(
        "[data-motion='section-content'] > *",
      );

      gsap
        .timeline({
          scrollTrigger: {
            trigger: board,
            start: "top 78%",
            end: "top 42%",
            toggleActions: "play none none reverse",
          },
          defaults: { ease: "power3.out" },
        })
        .to(board, { opacity: 1, visibility: "visible", y: 0, duration: 0.72 })
        .from(
          copy,
          {
            opacity: 0,
            visibility: "hidden",
            y: 24,
            duration: 0.58,
            stagger: 0.06,
          },
          "-=0.38",
        )
        .from(
          content,
          {
            opacity: 0,
            visibility: "hidden",
            y: 28,
            duration: 0.62,
            stagger: 0.08,
          },
          "-=0.3",
        );
    });

    if (flowCards.length) {
      gsap.to(flowCards, {
        opacity: 1,
        visibility: "visible",
        y: 0,
        duration: 0.68,
        stagger: 0.09,
        ease: "power3.out",
        scrollTrigger: {
          trigger: "#flow",
          start: "top 68%",
          toggleActions: "play none none reverse",
        },
      });
    }

    if (checkCards.length) {
      gsap.to(checkCards, {
        opacity: 1,
        visibility: "visible",
        y: 0,
        duration: 0.58,
        stagger: 0.045,
        ease: "power3.out",
        scrollTrigger: {
          trigger: "#checks",
          start: "top 66%",
          toggleActions: "play none none reverse",
        },
      });
    }

    gsap
      .timeline({
        scrollTrigger: {
          trigger: "[data-motion='split-section']",
          start: "top 70%",
          toggleActions: "play none none reverse",
        },
        defaults: { duration: 0.78, ease: "power3.out" },
      })
      .to(splitLeft, { opacity: 1, visibility: "visible", y: 0, x: 0 })
      .to(splitRight, { opacity: 1, visibility: "visible", y: 0, x: 0 }, "-=0.55");

    gsap.to(finalCard, {
      opacity: 1,
      visibility: "visible",
      y: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: {
        trigger: "[data-motion='final-section']",
        start: "top 76%",
        toggleActions: "play none none reverse",
      },
    });

    const media = gsap.matchMedia();

    media.add("(min-width: 900px)", () => {
      const receiptPanels = selector("[data-motion='receipt-panel']");
      const receiptCopy = selector("[data-motion='receipt-pin'] [data-motion='section-copy'] > *");

      gsap.set(receiptPanels, { transformOrigin: "50% 50%" });

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: "[data-motion='receipt-pin']",
          start: "top 12%",
          end: "+=72%",
          scrub: 0.8,
          pin: true,
          anticipatePin: 1,
        },
      });

      timeline
        .fromTo(
          receiptCopy,
          { opacity: 0.68, y: 20 },
          { opacity: 1, y: 0, stagger: 0.06, ease: "none" },
        )
        .fromTo(
          receiptPanels,
          { y: 50, opacity: 0.78 },
          { y: 0, opacity: 1, stagger: 0.08, ease: "none" },
          0,
        );

      return () => timeline.kill();
    });

    ScrollTrigger.refresh();

    return () => {
      media.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return null;
}
