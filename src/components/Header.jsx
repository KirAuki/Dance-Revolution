import { useEffect, useRef, useState } from "react";
import ArrowIcon from "./ArrowIcon.jsx";

const links = [
  ["about", "О проекте"],
  ["format", "Формат"],
  ["nominations", "Номинации"],
  ["awards", "Награды"],
  ["jury", "Жюри"],
  ["travel", "Участникам"],
  ["news", "Новости"],
  ["contacts", "Контакты"],
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [active, setActive] = useState("");
  const progressRef = useRef(null);
  const menuRef = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuRef.current.focus();
      }
      if (event.key === "Tab") {
        const focusable = [
          ...headerRef.current.querySelectorAll("a, button"),
        ].filter((node) => node.getClientRects().length);
        const first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onResize = () => {
      if (window.innerWidth > 900) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.classList.remove("menu-open");
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    let frame;
    const sections = links
      .map(([id]) => document.getElementById(id))
      .filter(Boolean);
    const update = () => {
      frame = undefined;
      const top = window.scrollY;
      const max = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1,
      );
      progressRef.current.style.transform = `scaleX(${Math.min(top / max, 1)})`;
      setScrolled(top > 30);
      setShowTop(top > window.innerHeight * 0.8);
      let current = "";
      for (const section of sections)
        if (section.getBoundingClientRect().top <= window.innerHeight * 0.4)
          current = section.id;
      setActive(current);
    };
    const schedule = () => {
      if (frame === undefined) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <>
      <div className="scroll-progress" aria-hidden="true">
        <span ref={progressRef} />
      </div>
      <header
        ref={headerRef}
        className={`site-header${scrolled ? " is-scrolled" : ""}`}
      >
        <div className="shell site-header__inner">
          <a
            className="mini-logo"
            href="#top"
            aria-label="На главную"
            onClick={() => setOpen(false)}
          >
            <span>ТАНЦЕВАЛЬНАЯ</span>
            <strong>революция</strong>
          </a>
          <nav
            className={`site-nav${open ? " is-open" : ""}`}
            id="site-nav"
            aria-label="Главная навигация"
          >
            {links.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className={active === id ? "is-current" : undefined}
                aria-current={active === id ? "location" : undefined}
                onClick={() => setOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
          <a
            className="button button--lime site-header__cta"
            href="#application"
            onClick={() => setOpen(false)}
          >
            Подать заявку <ArrowIcon />
          </a>
          <button
            ref={menuRef}
            className="menu-button"
            type="button"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>
      <a
        className={`back-to-top${showTop ? " is-visible" : ""}`}
        href="#top"
        aria-label="Вернуться в начало страницы"
      >
        <ArrowIcon direction="up" />
      </a>
    </>
  );
}
