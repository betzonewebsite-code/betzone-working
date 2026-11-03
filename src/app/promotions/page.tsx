import Link from "next/link";
import ThreeCol from "@/components/layout/ThreeCol";

const BONUS = [[3, 3], [4, 5], [5, 8], [6, 12], [7, 15], [8, 20], [9, 25], [10, "30"]];

export default function Promotions() {
  const card = "panel space-y-2 p-4";
  return (
    <ThreeCol>
      <div className="space-y-3">
        <h1 className="text-lg font-bold">Promotions and features</h1>
        <section className={card}>
          <h2 className="font-bold">Super Bonus on multiples</h2>
          <p className="text-sm text-neutral-600">Extra winnings on multiple bets with three or more selections at odds of 1.20 or higher. The bonus is a percentage of your winnings, paid when every selection wins.</p>
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-neutral-500"><th className="py-1">Selections</th><th>Bonus</th></tr></thead>
            <tbody>{BONUS.map(([n, p]) => <tr key={n} className="border-t border-[var(--line)]"><td className="py-1">{n}{n === 10 ? " or more" : ""}</td><td className="font-bold text-win">{p}%</td></tr>)}</tbody></table>
        </section>
        <section className={card}><h2 className="font-bold">Flexi (Cut 1 and Cut 2)</h2><p className="text-sm text-neutral-600">Still get paid if one or two of your selections lose. Your stake is split across every combination that can survive the cut.</p></section>
        <section className={card}><h2 className="font-bold">Cash out, partial cash out and auto cash out</h2><p className="text-sm text-neutral-600">Take your winnings before the final whistle, take part and keep the rest running, or set a target so the bet cashes out for you. Offers move with the match and pause while markets are locked.</p><Link href="/my-bets" className="text-sm font-bold text-brand underline">Go to My Bets</Link></section>
        <section className={card}><h2 className="font-bold">Booking codes and the community feed</h2><p className="text-sm text-neutral-600">Book your slip to get a short code, share it, or load a friend&apos;s code in one tap.</p><Link href="/feed" className="text-sm font-bold text-brand underline">Open the feed</Link></section>
        <section className={card}><h2 className="font-bold">Jackpot</h2><p className="text-sm text-neutral-600">Pick 1, X or 2 for a set of matches and share the prize pool.</p><Link href="/jackpot" className="text-sm font-bold text-brand underline">Play the jackpot</Link></section>
        <section className={`${card} !border-brand`}><h2 className="font-bold">Play responsibly</h2><p className="text-sm text-neutral-600">You must be 18 or older. Betting is entertainment, not a way to make money. Only stake what you can afford to lose. Terms and conditions apply to all promotions.</p></section>
      </div>
    </ThreeCol>
  );
}
