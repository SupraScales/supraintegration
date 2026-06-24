import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Services } from "@/components/services";
import { Approach } from "@/components/approach";
import { TrustStrip } from "@/components/trust-strip";
import { CTA } from "@/components/cta";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Services />
        <Approach />
        <TrustStrip />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
