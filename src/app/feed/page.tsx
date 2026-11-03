import ThreeCol from "@/components/layout/ThreeCol";
import ClientOnly from "@/components/ui/ClientOnly";
import FeedView from "@/components/feed/FeedView";

export default function Page() {
  return <ThreeCol><ClientOnly><FeedView /></ClientOnly></ThreeCol>;
}
