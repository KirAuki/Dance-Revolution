import { useEffect, useState } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion.js";

export default function PageLoader() {
  const [hidden, setHidden] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    // Never wait indefinitely for an image, video or external resource.
    const timer = setTimeout(() => setHidden(true), reduced ? 0 : 1050);
    return () => clearTimeout(timer);
  }, [reduced]);
  return (
    <div
      className={`page-loader${hidden ? " is-hidden" : ""}`}
      aria-hidden="true"
    >
      <div className="page-loader__mark">
        <span>ТАНЦЕВАЛЬНАЯ</span>
        <strong>революция</strong>
      </div>
      <div className="page-loader__line">
        <i />
      </div>
    </div>
  );
}
