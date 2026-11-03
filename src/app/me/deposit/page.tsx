import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";
import DepositFlow from "@/components/wallet/DepositFlow";

export default function Page() {
  return <ThreeCol><ClientOnly><DepositFlow /></ClientOnly></ThreeCol>;
}
