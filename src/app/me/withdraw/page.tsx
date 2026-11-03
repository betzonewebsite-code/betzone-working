import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";
import WithdrawFlow from "@/components/wallet/WithdrawFlow";

export default function Page() {
  return <ThreeCol><ClientOnly><WithdrawFlow /></ClientOnly></ThreeCol>;
}
