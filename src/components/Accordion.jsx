import { useState } from "react";

export default function Accordion({
  items,
  className,
  numbered = false,
  defaultOpen = null,
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      {items.map((item, index) => (
        <details key={item.title} open={open === index}>
          <summary
            onClick={(event) => {
              event.preventDefault();
              setOpen(open === index ? null : index);
            }}
          >
            {numbered && <span>{String(index + 1).padStart(2, "0")}</span>}
            {item.title}
            <i aria-hidden="true">+</i>
          </summary>
          <p>{item.description}</p>
        </details>
      ))}
    </div>
  );
}
