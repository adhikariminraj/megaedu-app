"use client";

import { useEffect, useRef, useState } from "react";

// Matches the A4 landscape px dimensions in CertificateDocument.tsx.
const A4_WIDTH_PX = 1123;
const A4_HEIGHT_PX = 794;

export default function CertificateScaler({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function updateScale() {
      const available = containerRef.current?.offsetWidth ?? A4_WIDTH_PX;
      setScale(Math.min(1, available / A4_WIDTH_PX));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div ref={containerRef} className="w-full print:contents">
      <div
        style={{ width: A4_WIDTH_PX * scale, height: A4_HEIGHT_PX * scale }}
        className="mx-auto print:!w-auto print:!h-auto"
      >
        <div
          style={{ width: A4_WIDTH_PX, height: A4_HEIGHT_PX, transform: `scale(${scale})`, transformOrigin: "top left" }}
          className="print:!transform-none"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
