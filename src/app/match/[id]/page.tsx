import ThreeCol from "@/components/layout/ThreeCol";
import MatchDetail from "@/components/match/MatchDetail";

export default function MatchPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-white text-[#171717]">
      <ThreeCol>
        <MatchDetail id={params.id} />
      </ThreeCol>
    </div>
  );
}
