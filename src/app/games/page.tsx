import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";
import GamesLobby from "@/components/games/GamesLobby";
const CATS = ["crash", "slots", "other"];

export default function Page() {
  return <ThreeCol><ClientOnly><GamesLobby title="Games" categories={CATS} emptyNote="Games are supplied by a licensed game provider and will appear here once one is connected." /></ClientOnly></ThreeCol>;
}
