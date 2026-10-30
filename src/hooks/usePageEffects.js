import { useEffect } from "react";
import { useReducedMotion } from "./useReducedMotion.js";

export function usePageEffects(pageRef) {
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const elements = pageRef.current.querySelectorAll(".reveal");
    let observer;
    if (!reduceMotion && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
      );
      elements.forEach((element) => observer.observe(element));
    } else elements.forEach((element) => element.classList.add("is-visible"));

    const media = [...pageRef.current.querySelectorAll(".parallax-media")];
    let frame;
    const update = () => {
      frame = undefined;
      for (const element of media) {
        if (reduceMotion) {
          element.style.removeProperty("--parallax-y");
          continue;
        }
        const rect = element.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) {
          const offset =
            (rect.top + rect.height / 2 - window.innerHeight / 2) * -0.055;
          element.style.setProperty(
            "--parallax-y",
            `${Math.max(-38, Math.min(38, offset))}px`,
          );
        }
      }
    };
    const schedule = () => {
      if (frame === undefined) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [pageRef, reduceMotion]);
}
