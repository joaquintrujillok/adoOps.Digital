"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./Preloader.module.css";

// Superficies donde el preloader estorba (consola y pantalla de TV Mix).
const SKIP_PREFIXES = ["/mix", "/tv"];

const TRACE_PATH =
  "M 845 160 C 792 56 636 56 636 160 C 636 264 792 264 845 160 C 898 56 1058 56 1058 160 C 1058 264 898 264 845 160 Z";

const clamp = (value: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, value));

const easeInOut = (value: number) =>
  value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;

const bump = (value: number, width: number) => {
  if (Math.abs(value) > width) return 0;
  const normalized = clamp(Math.abs(value) / width);
  return Math.cos((normalized * Math.PI) / 2) ** 2;
};

export default function Preloader() {
  const pathname = usePathname();
  // Decidido una sola vez al montar (igual que la animación, que corre una vez
  // por carga completa de página).
  const [skip] = useState(() =>
    SKIP_PREFIXES.some((prefix) => pathname?.startsWith(prefix)),
  );
  const [hidden, setHidden] = useState(false);
  const fillRef = useRef<HTMLImageElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<SVGPathElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const iaRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (skip) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (reducedMotion) {
      if (fillRef.current) {
        fillRef.current.style.maskImage =
          "linear-gradient(90deg,#000 0%,#000 100%)";
        fillRef.current.style.webkitMaskImage =
          "linear-gradient(90deg,#000 0%,#000 100%)";
      }
      if (barRef.current) barRef.current.style.width = "100%";
      if (percentRef.current) percentRef.current.textContent = "100%";
      if (statusRef.current) statusRef.current.textContent = "Listo";
      if (taglineRef.current) {
        taglineRef.current.style.opacity = "1";
        taglineRef.current.style.transform = "translateY(0)";
      }

      const reducedTimer = window.setTimeout(() => setHidden(true), 700);
      const unlockTimer = window.setTimeout(() => {
        document.body.style.overflow = previousOverflow;
      }, 900);

      return () => {
        window.clearTimeout(reducedTimer);
        window.clearTimeout(unlockTimer);
        document.body.style.overflow = previousOverflow;
      };
    }

    const track = trackRef.current;
    const total = track?.getTotalLength() ?? 100;
    const segment = total * 0.16;
    const duration = 4.35;
    const start = performance.now();
    let animationFrame = 0;
    let exitTimer = 0;
    let lastPercent = -1;
    let lastStatus = "";

    const animate = (now: number) => {
      const elapsed = (now - start) / 1000;
      const rawProgress = clamp((elapsed - 0.25) / 2.55);
      const progress = easeInOut(rawProgress);
      const percent = Math.round(progress * 100);

      if (fillRef.current) {
        const edge = progress * 100;
        const mask = `linear-gradient(90deg,#000 0%,#000 ${Math.max(edge - 4, 0)}%,transparent ${edge}%)`;
        fillRef.current.style.maskImage = mask;
        fillRef.current.style.webkitMaskImage = mask;
      }

      if (barRef.current) barRef.current.style.width = `${percent}%`;

      if (percentRef.current && percent !== lastPercent) {
        percentRef.current.textContent = `${percent}%`;
        lastPercent = percent;
      }

      let status = "Adoptando IA";
      if (percent >= 100) status = "Listo";
      else if (progress >= 0.66) status = "Escalando IA";
      else if (progress >= 0.33) status = "Operando IA";

      if (statusRef.current && status !== lastStatus) {
        statusRef.current.textContent = status;
        lastStatus = status;
      }

      const position = (elapsed * 1.05 * total) % total;
      if (trailRef.current) {
        trailRef.current.style.strokeDasharray = `${segment} ${total}`;
        trailRef.current.style.strokeDashoffset = `${-position}`;
      }

      if (headRef.current && track) {
        const point = track.getPointAtLength((position + segment) % total);
        headRef.current.setAttribute("cx", `${point.x}`);
        headRef.current.setAttribute("cy", `${point.y}`);
      }

      if (glowRef.current) {
        const breathe = 0.5 + 0.5 * Math.sin(elapsed * 3.1);
        glowRef.current.style.opacity = `${progress * (0.55 + 0.45 * breathe)}`;
        glowRef.current.style.transform = `translate(-50%,-50%) scale(${0.6 + 0.22 * breathe + 0.15 * progress})`;
      }

      if (taglineRef.current) {
        const reveal = clamp((elapsed - 2.85) / 0.4);
        taglineRef.current.style.opacity = `${reveal}`;
        taglineRef.current.style.transform = `translateY(${(1 - reveal) * 8}px)`;
      }

      iaRefs.current.forEach((element, index) => {
        if (!element) return;
        const pulse = bump(elapsed - (3.25 + index * 0.28), 0.28);
        element.style.transform = `translateY(${-3 * pulse}px) scale(${1 + 0.42 * pulse})`;
        element.style.color =
          pulse > 0.02
            ? `rgb(${Math.round(32 + 4 * pulse)},${Math.round(180 + 30 * pulse)},${Math.round(80 + 20 * pulse)})`
            : "#20a64c";
        element.style.filter =
          pulse > 0.02
            ? `drop-shadow(0 0 ${8 * pulse}px rgba(43,220,110,${0.85 * pulse}))`
            : "none";
      });

      if (elapsed < duration) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setHidden(true);
        exitTimer = window.setTimeout(() => {
          document.body.style.overflow = previousOverflow;
        }, 420);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(exitTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [skip]);

  if (skip) return null;

  return (
    <div
      className={`${styles.preloader} ${hidden ? styles.hidden : ""}`}
      aria-hidden={hidden}
      aria-label="Cargando adoOps"
      role="status"
    >
      <div className={styles.content}>
        <div className={styles.logo}>
          <div className={styles.glow} ref={glowRef} />
          <Image
            className={`${styles.wordmark} ${styles.wordmarkBase}`}
            src="/loader-wordmark.png"
            alt="adoOps"
            width={1219}
            height={345}
            priority
          />
          <Image
            className={`${styles.wordmark} ${styles.wordmarkFill}`}
            src="/loader-wordmark.png"
            alt=""
            ref={fillRef}
            width={1219}
            height={345}
            priority
          />

          <svg
            className={styles.trace}
            viewBox="0 0 1219 345"
            aria-hidden="true"
          >
            <path
              ref={trackRef}
              d={TRACE_PATH}
              fill="none"
              stroke="rgba(31,202,92,0.16)"
              strokeLinecap="round"
              strokeWidth="6"
            />
            <path
              ref={trailRef}
              className={styles.trail}
              d={TRACE_PATH}
              fill="none"
              stroke="#2bdc6e"
              strokeLinecap="round"
              strokeWidth="7"
            />
            <circle
              ref={headRef}
              className={styles.head}
              cx="852"
              cy="150"
              fill="#eafff2"
              r="9"
            />
          </svg>
        </div>

        <div className={styles.progress}>
          <div className={styles.progressTrack}>
            <div className={styles.progressBar} ref={barRef} />
          </div>
          <div className={styles.progressMeta}>
            <span ref={statusRef}>Inicializando</span>
            <span className={styles.percent} ref={percentRef}>
              0%
            </span>
          </div>
        </div>
      </div>

      <div className={styles.tagline} ref={taglineRef}>
        <span>ADOPTAMOS&nbsp;</span>
        <span className={styles.ia} ref={(node) => { iaRefs.current[0] = node; }}>
          IA
        </span>
        <span>.&nbsp;&nbsp;OPERAMOS&nbsp;</span>
        <span className={styles.ia} ref={(node) => { iaRefs.current[1] = node; }}>
          IA
        </span>
        <span>.&nbsp;&nbsp;ESCALAMOS&nbsp;</span>
        <span className={styles.ia} ref={(node) => { iaRefs.current[2] = node; }}>
          IA
        </span>
        <span>.</span>
      </div>
    </div>
  );
}
