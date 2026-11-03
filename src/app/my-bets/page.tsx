import ThreeCol from "@/components/layout/ThreeCol";
import MyBets from "@/components/bets/MyBets";
import ClientOnly from "@/components/ui/ClientOnly";

export default function MyBetsPage() {
  return <ThreeCol><ClientOnly><MyBets /></ClientOnly></ThreeCol>;
}
