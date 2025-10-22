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

      {/* <div className="pointer-events-none absolute bottom-16 right-16 z-20 flex items-center gap-3">
        <span className="pointer-events-auto inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-slate-900/40">
          Chat with AI
        </span>
        <button
          type="button"
          onClick={handleChatClick}
          aria-label="Open AI chat"
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/40 transition hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          💬
        </button>
      </div> */}
    </div>
  );
}