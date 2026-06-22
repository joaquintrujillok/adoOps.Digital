"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./ClosingAnimation.module.css";

const TRACE_PATH =
  "M 845 160 C 792 56 636 56 636 160 C 636 264 792 264 845 160 C 898 56 1058 56 1058 160 C 1058 264 898 264 845 160 Z";

export default function ClosingAnimation() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setActive(true);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`${styles.section} ${active ? styles.active : ""}`}
      aria-label="Adoptamos IA. Operamos IA. Escalamos IA."
    >
      <div className={styles.content}>
        <div className={styles.logo}>
          <div className={styles.glow} />

          <Image
            className={`${styles.wordmark} ${styles.wordmarkBase}`}
            src="/loader-wordmark.png"
            alt="adoOps"
            width={1219}
            height={345}
          />
          <Image
            className={`${styles.wordmark} ${styles.wordmarkFill}`}
            src="/loader-wordmark.png"
            alt=""
            width={1219}
            height={345}
          />

          <svg
            className={styles.trace}
            viewBox="0 0 1219 345"
            aria-hidden="true"
          >
            <path
              d={TRACE_PATH}
              fill="none"
              stroke="rgba(31,202,92,0.16)"
              strokeLinecap="round"
              strokeWidth="6"
            />
            <path
              className={styles.comet}
              d={TRACE_PATH}
              fill="none"
              pathLength="100"
              stroke="#2bdc6e"
              strokeDasharray="17 83"
              strokeDashoffset="0"
              strokeLinecap="round"
              strokeWidth="7"
            />
          </svg>
        </div>

        <div className={styles.tagline}>
          <span>ADOPTAMOS&nbsp;</span>
          <span className={styles.ia}>IA</span>
          <span>.&nbsp;&nbsp;OPERAMOS&nbsp;</span>
          <span className={styles.ia}>IA</span>
          <span>.&nbsp;&nbsp;ESCALAMOS&nbsp;</span>
          <span className={styles.ia}>IA</span>
          <span>.</span>
        </div>
      </div>
    </section>
  );
}
