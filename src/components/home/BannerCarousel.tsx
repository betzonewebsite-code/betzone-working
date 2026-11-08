"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
  {
    title: "BETZONE GH promotional banner",
    image: "/betzone-banner.png",
    alt: "BETZONE GH promotional banner",
  },
  {
    title: "BETZONE Instant Virtuals",
    image: "/instant-virtuals-banner.png",
    alt: "BETZONE Instant Virtuals promotional banner",
  },
  {
    title: "BETZONE Football Betting",
    image: "/football-betting-banner.png",
    alt: "BETZONE football betting promotion",
  },
  {
    title: "BETZONE Cash Out",
    image: "/cashout-banner.png",
    alt: "BETZONE Cash Out promotion",
  },
  {
    title: "BETZONE Dream Big",
    image: "/inspiring-banner.png",
    alt: "BETZONE Dream Big, Bet Bigger promotion",
  },
];

export default function BannerCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (
      paused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;

    const id = setInterval(() => {
      setI((n) => (n + 1) % SLIDES.length);
    }, 5000);

    return () => clearInterval(id);
  }, [paused]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="BETZONE promotions"
      className="relative overflow-hidden rounded-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${i * 100}%)` }}
      >
        {SLIDES.map((s, n) => (
          <div
            key={s.title}
            aria-hidden={n !== i}
            className="min-w-full"
          >
            <Image
              src={s.image}
              alt={s.alt}
              width={1792}
              height={1024}
              priority={n === 0}
              sizes="(max-width: 768px) 100vw, 1400px"
              className="block h-auto w-full"
            />
          </div>
        ))}
      </div>

      <div className="absolute bottom-2 right-3 flex gap-1.5">
        {SLIDES.map((s, n) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Show slide ${n + 1}: ${s.title}`}
            aria-current={n === i}
            onClick={() => setI(n)}
            className={`h-1.5 rounded-full transition-all ${
              n === i ? "w-5 bg-white" : "w-1.5 bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
