import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion.js";

export default function HeroVideo() {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const video = ref.current;
    video.playbackRate = 0.72;
    if (reduceMotion) video.pause();
    else video.play().catch(() => {}); // Poster remains visible if autoplay is blocked.
    return () => video.pause();
  }, [reduceMotion]);
  return (
    <video
      ref={ref}
      className="hero__video"
      autoPlay={!reduceMotion}
      muted
      loop
      playsInline
      preload="metadata"
      poster="/assets/hero-ensemble-poster.webp"
      aria-hidden="true"
    >
      <source src="/assets/hero-video.mp4" type="video/mp4" />
    </video>
  );
}
