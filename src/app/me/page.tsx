import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";
import MeDashboard from "@/components/wallet/MeDashboard";

export default function Page() {
  return <ThreeCol><ClientOnly><MeDashboard /></ClientOnly></ThreeCol>;
}
