"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Gate } from "@/components/Gate";
import { useFamily } from "@/lib/store";

/** Wall devices land on the wall; parents land on their dashboard. */
export default function Home() {
  return (
    <Gate>
      <Redirect />
    </Gate>
  );
}

function Redirect() {
  const router = useRouter();
  const family = useFamily();
  useEffect(() => {
    router.replace(family.viewer?.kind === "parent" ? "/parent" : "/wall");
  }, [family.viewer, router]);
  return null;
}
