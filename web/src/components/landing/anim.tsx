"use client";

// Shared landing motion helpers: a scroll-reveal wrapper and a count-up number
// that animates the first time it scrolls into view.

import { useEffect, useRef, useState } from "react";
import { motion, useInView, type HTMLMotionProps } from "framer-motion";

export function Reveal({ delay = 0, children, ...rest }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 0.7, 0.2, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Counter({
  to, prefix = "", suffix = "", decimals = 0, duration = 1300,
}: { to: number; prefix?: string; suffix?: string; decimals?: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0, t0 = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const p = Math.min((t - t0) / duration, 1);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return <span ref={ref}>{prefix}{v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}{suffix}</span>;
}
