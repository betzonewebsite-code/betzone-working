import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";
import PinSetup from "@/components/wallet/PinSetup";

export default function Page() {
  return <ThreeCol><ClientOnly><PinSetup /></ClientOnly></ThreeCol>;
}
