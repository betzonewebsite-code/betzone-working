import { Suspense } from "react";
import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";
import DepositReturn from "@/components/wallet/DepositReturn";

export default function Page() {
  return <ThreeCol><ClientOnly><Suspense fallback={null}><DepositReturn /></Suspense></ClientOnly></ThreeCol>;
}
