import ClientOnly from "@/components/ui/ClientOnly";
import VirtualsView from "@/components/virtuals/VirtualsView";

export default function Page() {
  return (
    <main className="min-h-screen w-full">
      <ClientOnly>
        <VirtualsView />
      </ClientOnly>
    </main>
  );
}
