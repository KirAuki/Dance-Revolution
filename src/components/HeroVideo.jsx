import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion.js";
import { useSiteSettings } from "../SiteSettings.jsx";

export default function HeroVideo() {
  const { home } = useSiteSettings();
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const video = ref.current;
    video.playbackRate = 0.72;
    if (reduceMotion) {
      video.pause();
      return;
    }
    let visible = !("IntersectionObserver" in window);
    const update = () => {
      if (visible && !document.hidden)
        video.play().catch(() => {}); // Keep the poster if autoplay is blocked.
      else video.pause();
    };
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          update();
        })
      : null;
    observer?.observe(video);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
      video.pause();
    };
  }, [reduceMotion]);
  return (
    <video
      ref={ref}
      className="hero__video"
      muted
      loop
      playsInline
      preload="metadata"
      poster={home.hero.poster}
      aria-hidden="true"
    >
      <source src="/assets/hero-video.mp4" type="video/mp4" />
    </video>
  );
}
