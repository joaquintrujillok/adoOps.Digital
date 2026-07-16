import type { Metadata } from "next";
import MixLanding from "@/components/mixer/MixLanding";

export const metadata: Metadata = {
  title: "TV Mix — mezcla YouTube sincronizado con tu TV | adoOps",
  description:
    "Mezcla videos de YouTube desde tu celular o computador, con el video y el audio sincronizados en tu televisor.",
  robots: { index: false },
};

export default function MixPage() {
  return <MixLanding />;
}
