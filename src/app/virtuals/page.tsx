import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";
import VirtualsView from "@/components/virtuals/VirtualsView";

export default function Page() {
  return <ThreeCol><ClientOnly><VirtualsView /></ClientOnly></ThreeCol>;
}
