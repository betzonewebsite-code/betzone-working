"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("bz-theme"); } catch { /* storage blocked */ }
    const d = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(d); document.documentElement.classList.toggle("dark", d);
  }, []);
  const flip = () => {
    const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("bz-theme", d ? "dark" : "light"); } catch { /* ignore */ }
  };
  return <button onClick={flip} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className="text-white/80 hover:text-white">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>;
}
