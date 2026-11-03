import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";
import GamesLobby from "@/components/games/GamesLobby";
const CATS = ["virtual-scheduled"];

export default function Page() {
  return <ThreeCol><ClientOnly><GamesLobby title="Scheduled Virtuals" categories={CATS} emptyNote="Scheduled virtual sports come from a licensed provider and will appear here once one is connected." /></ClientOnly></ThreeCol>;
}
