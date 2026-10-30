import { useRef } from "react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import PageLoader from "./components/PageLoader.jsx";
import Hero from "./sections/Hero.jsx";
import About from "./sections/About.jsx";
import Format from "./sections/Format.jsx";
import Venue from "./sections/Venue.jsx";
import Nominations from "./sections/Nominations.jsx";
import Categories from "./sections/Categories.jsx";
import Awards from "./sections/Awards.jsx";
import Premium from "./sections/Premium.jsx";
import Jury from "./sections/Jury.jsx";
import Travel from "./sections/Travel.jsx";
import Schedule from "./sections/Schedule.jsx";
import Conditions from "./sections/Conditions.jsx";
import Faq from "./sections/Faq.jsx";
import Application from "./sections/Application.jsx";
import { usePageEffects } from "./hooks/usePageEffects.js";

export default function App() {
  const pageRef = useRef(null);
  usePageEffects(pageRef);
  return (
    <div ref={pageRef}>
      <PageLoader />
      <Header />
      <main>
        <Hero />
        <div className="marquee marquee--lime" aria-hidden="true">
          <div className="marquee__track">
            <span>ТВОЙ ТАНЕЦ · ТВОЯ СЦЕНА · ТВОЯ РЕВОЛЮЦИЯ ·</span>
            <span>ТВОЙ ТАНЕЦ · ТВОЯ СЦЕНА · ТВОЯ РЕВОЛЮЦИЯ ·</span>
          </div>
        </div>
        <About />
        <Format />
        <Venue />
        <Nominations />
        <Categories />
        <Awards />
        <Premium />
        <Jury />
        <Travel />
        <Schedule />
        <Conditions />
        <Faq />
        <Application />
      </main>
      <Footer />
    </div>
  );
}
