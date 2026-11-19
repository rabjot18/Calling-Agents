import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import { redirect } from "next/navigation";
import { businessFor, currentUser } from "@/lib/auth";
import { Landing } from "./Landing";

// The landing's headline face: a book serif, used at regular weight for headings only.
const serif = Newsreader({ variable: "--font-serif", subsets: ["latin"], axes: ["opsz"] });

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pulse, the AI receptionist that writes every call into your day",
  description: "Pulse is the AI receptionist for salons, clinics and trades. It picks up when you can't, books and takes messages, and puts every call on one page.",
};

// Landing page → Get Started (sign-up) → onboarding. Signed-in owners go straight to their dashboard or setup.
export default async function Home() {
  const u = await currentUser();
  if (u) redirect(businessFor(u.id).onboarding_step === "done" ? "/dashboard" : "/onboarding");
  return (
    <div className={serif.variable}>
      <Landing />
    </div>
  );
}
