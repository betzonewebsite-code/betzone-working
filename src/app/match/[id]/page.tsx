import ThreeCol from "@/components/layout/ThreeCol";
import MatchDetail from "@/components/match/MatchDetail";

export default function MatchPage({ params }: { params: { id: string } }) {
  return <ThreeCol><MatchDetail id={params.id} /></ThreeCol>;
}
