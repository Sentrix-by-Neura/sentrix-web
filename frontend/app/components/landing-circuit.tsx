import { useLayoutEffect, useRef } from "react";

type Pattern = "overview" | "hardware" | "specifications" | "footer";
type Point = readonly [x: number, y: number];
type Box = { left: number; top: number; right: number; bottom: number };

type Circuit = {
  route: Point[];
  branches?: Point[][];
  terminals: Point[];
};

function bounds(element: HTMLElement, section: HTMLElement): Box {
  // Offset coordinates stay fixed while the foreground slides into view.
  let left = 0;
  let top = 0;
  let current: HTMLElement | null = element;
  while (current && current !== section) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  return { left, top, right: left + element.offsetWidth, bottom: top + element.offsetHeight };
}

function path(points: Point[]) {
  return "M" + points.map(([x, y]) => x + " " + y).join("L");
}

function overview([intro, ...cards]: Box[]): Circuit {
  const rail = cards[0].left - 11;
  const source: Point = [intro.left + 22, intro.bottom + 8];
  const terminals: Point[] = cards.map((card) => [card.left + 22, card.top]);
  const tap = ([x, y]: Point): Point[] => [[rail, y - 15], [x - 8, y - 15], [x, y - 7], [x, y]];
  const last = terminals[terminals.length - 1];
  const branches = terminals.slice(0, -1).map(tap);
  const tree: Circuit = {
    route: [source, [rail + 8, source[1]], [rail, source[1] + 8], ...tap(last)],
    branches,
    terminals: [source, ...terminals],
  };

  const fork = last[0] - 44;
  if (terminals[0][1] === last[1] && fork > intro.right + 16) {
    const top = intro.top + 44;
    const outer: Point = [last[0] + 146, top];
    const inner: Point = [last[0] + 95, top + 24];
    branches.push([[fork, last[1] - 15], [fork, top + 44], [last[0], top], outer]);
    branches.push([[fork, top + 84], [fork + 20, top + 84], [last[0] + 16, top + 24], inner]);
    tree.terminals.push(outer, inner);
  }
  return tree;
}

function hardware([prototype, ...steps]: Box[]): Circuit {
  const rail = steps[0].left - 12;
  const terminals: Point[] = steps.map((step) => [step.left - 3, (step.top + step.bottom) / 2]);
  const horizontal = prototype.right < rail;
  const source: Point = horizontal
    ? [prototype.right, terminals[0][1] - 15]
    : [prototype.left + 44, prototype.bottom];

  const entry: Point[] = horizontal
    ? [[rail - 8, source[1]], [rail, source[1] + 8]]
    : [[source[0], source[1] + 10], [rail + 8, source[1] + 10], [rail, source[1] + 18]];

  const last = terminals[terminals.length - 1];
  const branches: Point[][] = terminals.slice(0, -1).map((terminal) => [[rail, terminal[1] - 9], terminal]);
  const relay: Circuit = {
    route: [source, ...entry, [rail, last[1] - 9], last],
    branches,
    terminals: [source, ...terminals],
  };

  if (horizontal) {
    const base = prototype.top - 16;
    const end: Point = [rail + 242, base];
    branches.push([
      [rail, source[1] + 8], [rail, base + 8], [rail + 8, base],
      [rail + 44, base], [rail + 64, base - 20], [rail + 104, base - 20],
      [rail + 124, base], [rail + 152, base], [rail + 166, base - 14],
      [rail + 204, base - 14], [rail + 218, base], end,
    ]);
    relay.terminals.push(end);
  }
  return relay;
}

function specifications([table, diagram, action]: Box[]): Circuit {
  const horizontal = table.right < diagram.left;
  const tracks = [-9, 0, 9].map((lane): Point[] => {
    if (horizontal) {
      const from = table.top + (table.bottom - table.top) * 0.36 + lane;
      const to = diagram.top + (diagram.bottom - diagram.top) * 0.56 + lane;
      const elbow = (table.right + diagram.left) / 2 + (to > from ? -lane : lane);
      return [[table.right, from], [elbow, from], [elbow, to], [diagram.left, to]];
    }

    const x = table.right - 54 + lane;
    const to = diagram.right - 42 + lane;
    const elbow = (table.bottom + diagram.top) / 2 - lane;
    return [[x, table.bottom], [x, elbow], [to, elbow], [to, diagram.top]];
  });

  const exit: Point = [diagram.right - 34, diagram.bottom];
  const target: Point = [action.right - 58, action.top];
  const link: Point[] = [
    exit,
    [exit[0], target[1] - 29],
    [target[0], target[1] - 10],
    target,
  ];
  return {
    route: tracks[1],
    branches: [tracks[0], tracks[2], link],
    terminals: [...tracks.flatMap((track) => [track[0], track[3]]), exit, target],
  };
}

function footer([brand, credits]: Box[]): Circuit {
  const left = brand.left - 12;
  const right = credits.right + 12;
  const top = brand.top - 17;
  const bottom = credits.top - 14;
  const source: Point = [brand.left, brand.top + 14];
  const target: Point = [credits.left + 42, credits.top];

  return {
    route: [
      source, [left, source[1]], [left, top + 8], [left + 8, top],
      [right - 8, top], [right, top + 8], [right, bottom - 8],
      [right - 8, bottom], [target[0] + 14, bottom], target,
    ],
    branches: [[[right - 18, top + 6], [right - 6, top + 18], [right - 6, top + 44]]],
    terminals: [source, target, [right - 6, top + 44]],
  };
}

const patterns = {
  overview: { draw: overview, anchors: 4 },
  hardware: { draw: hardware, anchors: 5 },
  specifications: { draw: specifications, anchors: 3 },
  footer: { draw: footer, anchors: 2 },
};

export function LandingCircuit({ pattern }: { pattern: Pattern }) {
  const layerRef = useRef<SVGSVGElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const branchesRef = useRef<SVGPathElement>(null);
  const terminalsRef = useRef<SVGPathElement>(null);
  const pulseRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const section = layerRef.current?.parentElement;
    if (!section) return;

    const anchors = [...section.querySelectorAll<HTMLElement>("[data-landing-circuit-anchor]")];
    const { anchors: required, draw } = patterns[pattern];
    if (anchors.length !== required) return;

    const update = () => {
      const circuit = draw(anchors.map((element) => bounds(element, section)));
      const route = path(circuit.route);
      routeRef.current?.setAttribute("d", route);
      pulseRef.current?.setAttribute("d", route);
      branchesRef.current?.setAttribute("d", (circuit.branches ?? []).map(path).join(""));
      terminalsRef.current?.setAttribute("d", circuit.terminals.map(([x, y]) =>
        "M" + (x - 2.5) + " " + y + "a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0"
      ).join(""));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(section);
    anchors.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pattern]);

  return (
    <svg
      ref={layerRef}
      aria-hidden="true"
      focusable="false"
      data-landing-circuit={pattern}
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-hidden text-amber-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
    >
      <path ref={routeRef} data-circuit-route opacity=".29" />
      <path ref={branchesRef} opacity=".22" />
      <path ref={terminalsRef} opacity=".52" />
      <path
        ref={pulseRef}
        data-landing-trace-pulse
        pathLength="1"
        strokeDasharray=".075 1"
        strokeLinecap="round"
        opacity="0"
      />
    </svg>
  );
}
