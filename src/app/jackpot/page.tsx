import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";
import JackpotView from "@/components/jackpot/JackpotView";

export default function Page() {
  return <ThreeCol><ClientOnly><JackpotView /></ClientOnly></ThreeCol>;
}
