"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

// Only advertise things the platform really does. Add a slide here when a real promotion exists.
const SLIDES = [
  { title: "Super Bonus up to 30% on multiples", sub: "Add more selections for a bigger bonus on your winnings.", cta: "See how it works", href: "/promotions", bg: "from-brand to-brand-dark" },
  { title: "Cash out before the final whistle", sub: "Take your winnings early, or cash out part and keep the rest running.", cta: "My bets", href: "/my-bets", bg: "from-ink-3 to-ink" },
  { title: "Share your slip with a booking code", sub: "Book a bet, share the code, and load slips from other players.", cta: "Open the feed", href: "/feed", bg: "from-win to-ink" },
];

export default function BannerCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <section aria-roledescription="carousel" aria-label="Promotions" className="relative overflow-hidden rounded-md"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${i * 100}%)` }}>
        {SLIDES.map((s, n) => (
          <div key={s.title} aria-hidden={n !== i} className={`flex h-28 min-w-full flex-col justify-center bg-gradient-to-r p-4 text-white lg:h-36 lg:p-6 ${s.bg}`}>
            <h2 className="text-lg font-extrabold leading-tight lg:text-2xl">{s.title}</h2>
            <p className="mt-1 max-w-md text-sm text-white/85">{s.sub}</p>
            <Link href={s.href} tabIndex={n === i ? 0 : -1} className="mt-2 w-fit rounded bg-white px-3 py-1 text-xs font-bold text-ink">{s.cta}</Link>
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 right-3 flex gap-1.5">
        {SLIDES.map((s, n) => (
          <button key={s.title} aria-label={`Show slide ${n + 1}`} aria-current={n === i} onClick={() => setI(n)}
            className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
        ))}
      </div>
    </section>
  );
}
