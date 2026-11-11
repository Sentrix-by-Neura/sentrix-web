import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useEffect, type RefObject } from "react";

export function useLandingMotion(landingRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const landing = landingRef.current;
    if (!landing) return;

    gsap.registerPlugin(ScrollTrigger);
    const motion = gsap.matchMedia();

    motion.add("(prefers-reduced-motion: no-preference)", () => {
      const intro = [...landing.querySelectorAll<HTMLElement>("[data-landing-intro]")]
        .filter((element) => element.getClientRects().length > 0);

      gsap.fromTo(intro, { opacity: 0.45, y: 12 }, {
        opacity: 1,
        y: 0,
        duration: 0.55,
        stagger: 0.055,
        ease: "power3.out",
        clearProps: "opacity,transform",
      });

      landing.querySelectorAll<HTMLElement>("[data-landing-reveal]").forEach((element, index) => {
        gsap.fromTo(element, { opacity: 0.4, y: 18 }, {
          opacity: 1,
          y: 0,
          duration: 0.55,
          delay: (index % 3) * 0.06,
          ease: "power3.out",
          immediateRender: false,
          clearProps: "opacity,transform",
          scrollTrigger: {
            trigger: element,
            start: "top 94%",
            once: true,
          },
        });
      });

      const pulse = landing.querySelector<SVGPathElement>("[data-landing-pulse]");
      if (pulse) {
        gsap.timeline()
          .to(pulse, { x: -445, duration: 4.2, ease: "none" }, 0)
          .to(pulse, { opacity: 0.7, duration: 0.65, ease: "sine.out" }, 0)
          .to(pulse, { opacity: 0, duration: 0.85, ease: "sine.in" }, 3.35);
      }
    });

    return () => motion.revert();
  }, [landingRef]);
}
