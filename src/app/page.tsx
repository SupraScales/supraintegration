import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { CommandCenter } from "@/components/command-center";
import { Services } from "@/components/services";
import { SystemFlow } from "@/components/system-flow";
import { Approach } from "@/components/approach";
import { TrustStrip } from "@/components/trust-strip";
import { CTA } from "@/components/cta";
import { Footer } from "@/components/footer";
import { Protocols } from "@/components/protocols";

export default function Home() {
  return (
    <div className="space-page">
      <Header />
      <main>
        <Hero />
        <Services />
        <SystemFlow />
        <CommandCenter />
        <Approach />
        <Protocols />
        <TrustStrip />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
