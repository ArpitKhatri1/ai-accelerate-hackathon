"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Dashboard from "@/components/dashboard";
import AIChat from "@/components/AIChat/AIChat";

export default function Home() {
  const chatRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const backgroundColorRef = useRef<HTMLDivElement>(null);
  const [isDashboardVisible, setIsDashboardVisible] = useState(true);

  const isMountedRef = useRef(false);

    console.log(isMountedRef.current)
  // This hook will now handle the "animate in"
  useGSAP(
    () => {
      // When the component mounts (or isDashboardVisible becomes true)
      // animate it "from" an invisible state.
      if (isMountedRef.current) {
        if (isDashboardVisible) {
          gsap.from(dashboardRef.current, {
            opacity: 0,
            y: 20,
            duration: 0.5,
            ease: "power2.out",
          });
        }
      }

      isMountedRef.current = true;

    },
    [isDashboardVisible]  // Rerun this effect when isDashboardVisible changes
  );

  const handleChatClick = () => {
    if (isDashboardVisible) {
      // --- HIDE ANIMATION ---
      const tl = gsap.timeline({
        onComplete: () => {
          setIsDashboardVisible(false);
        },
      });

      tl.to(backgroundColorRef.current, {
        backgroundColor: "#dbeafe", // to blue
        duration: 0.5,
        ease: "power3.inOut",
      });

      tl.to(
        dashboardRef.current,
        {
          opacity: 0,
          y: 50,
          duration: 0.5,
          ease: "power2.out",
        },
        "<"
      );
    } else {

      gsap.to(backgroundColorRef.current, {
        backgroundColor: "#ffffff", // back to white
        duration: 0.5,
        ease: "power3.inOut",
      });

      // 2. Set state to true. This will re-render, mount the
      //    Dashboard, and trigger the useGSAP hook to animate it in.
      setIsDashboardVisible(true);
    }
  };

  return (
    <div
      ref={backgroundColorRef}
      className="flex justify-center h-screen w-screen overflow-hidden bg-white relative"
    >
      {/* Dashboard container (for animation ref) */}
      {isDashboardVisible ? (
        <div ref={dashboardRef} className="relative z-10 h-full ">
          <Dashboard />
        </div>
      ) : (
        <AIChat />
      )}

      {/* Chat Bubble */}
      <div className="absolute right-16 bottom-16 z-20">
        <div
          ref={chatRef}
          onClick={handleChatClick}
          className="bg-red-800 h-10 w-10 rounded-full cursor-pointer"
        />
      </div>
    </div>
  );
}