"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Dashboard from "@/components/dashboard/dashboard";

export default function Home() {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const backgroundColorRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useGSAP(() => {
    if (dashboardRef.current) {
      gsap.from(dashboardRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: "power2.out",
      });
    }
  }, []);

  const handleChatClick = () => {
    router.push("/ai-chat");
  };

  return (
    <div
      ref={backgroundColorRef}
      className="relative w-full min-h-screen  pb-1  "
    >
      <div ref={dashboardRef} className="relative z-10 h-full mb-1">
        <Dashboard />
      </div>

  
    </div>
  );
}