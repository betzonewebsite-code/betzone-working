import VirtualMyBets from "@/components/virtuals/VirtualMyBets";
import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";

export default function InstantVirtualMyBetsPage() {
  return (
    <ThreeCol>
      <ClientOnly>
        <VirtualMyBets />
      </ClientOnly>
    </ThreeCol>
  );
}
