import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";
import TxTable from "@/components/wallet/TxTable";

export default function Page() {
  return <ThreeCol><ClientOnly><TxTable /></ClientOnly></ThreeCol>;
}
