import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion.js";

export default function Counter({ value, suffix = "" }) {
  const ref = useRef(null);
  const [count, setCount] = useState(value);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || !("IntersectionObserver" in window)) return;
    let frame;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const draw = (now) => {
          const progress = Math.min((now - start) / 850, 1);
          setCount(Math.round(value * (1 - (1 - progress) ** 3)));
          if (progress < 1) frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
      },
      { threshold: 0.75 },
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, reduced]);
  return (
    <strong ref={ref}>
      {reduced ? value : count}
      {suffix}
    </strong>
  );
}
