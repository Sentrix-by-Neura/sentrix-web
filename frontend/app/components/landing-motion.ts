import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useLayoutEffect, type RefObject } from "react";

export function useLandingMotion(landingRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const landing = landingRef.current;
    if (!landing) return;

    gsap.registerPlugin(ScrollTrigger);
    const motion = gsap.matchMedia();

    motion.add("(prefers-reduced-motion: no-preference)", () => {
      const intro = [...landing.querySelectorAll<HTMLElement>("[data-landing-intro]")]
        .filter((element) => element.getClientRects().length > 0);

      // The stylesheet hides the first frame. If its fallback has already
      // revealed the page, keep visible content in place.
      const initialFade = intro.length > 0 && getComputedStyle(intro[0]).opacity === "0";
      if (initialFade) {
        gsap.fromTo(intro, { opacity: 0, y: 12 }, {
          opacity: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.055,
          ease: "power3.out",
          clearProps: "opacity,transform",
        });
      }

      landing.querySelectorAll<HTMLElement>("[data-landing-reveal]").forEach((element, index) => {
        const { top, bottom } = element.getBoundingClientRect();
        if (bottom <= 0 || (!initialFade && top < window.innerHeight)) return;

        gsap.fromTo(element, { opacity: 0, y: 18 }, {
          opacity: 1,
          y: 0,
          duration: 0.55,
          delay: (index % 3) * 0.06,
          ease: "power3.out",
          clearProps: "opacity,transform",
          scrollTrigger: {
            trigger: element,
            start: "top bottom",
            once: true,
          },
        });
      });

      const pulse = landing.querySelector<SVGPathElement>("[data-landing-pulse]");
      if (pulse) {
        gsap.timeline({
          repeat: -1,
          scrollTrigger: {
            trigger: pulse.closest("section") ?? landing,
            start: "top bottom",
            end: "bottom top",
            toggleActions: "play pause resume pause",
          },
        })
          .fromTo(pulse, { x: 0 }, { x: -445, duration: 4.2, ease: "none" }, 0)
          .to(pulse, { opacity: 0.7, duration: 0.65, ease: "sine.out" }, 0)
          .to(pulse, { opacity: 0, duration: 0.85, ease: "sine.in" }, 3.35);
      }
    });

    landing.setAttribute("data-landing-motion-ready", "");
    return () => {
      motion.revert();
      landing.removeAttribute("data-landing-motion-ready");
    };
  }, [landingRef]);
}
