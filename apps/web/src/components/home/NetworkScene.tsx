/** Original isometric artwork. Coordinates are deterministic for SSR; no canvas or third-party models. */
const project = (x: number, y: number, z = 0) => [600 + (x - y) * 42, 170 + (x + y) * 21 - z];
const point = (x: number, y: number, z = 0) => project(x, y, z).join(',');
const polygon = (points: number[][]) => points.map(([x, y, z = 0]) => point(x!, y!, z)).join(' ');
const towers = Array.from({ length: 8 }, (_, x) =>
  Array.from({ length: 8 }, (_, y) => ({ x, y, height: 28 + ((x * 31 + y * 23) % 105) })),
)
  .flat()
  .filter(({ x, y }) => x !== 3 && y !== 4 && (x + y) % 3 !== 0);

export function NetworkScene({ dark = false }: { dark?: boolean }) {
  return (
    <svg
      className={`hm-network ${dark ? 'hm-network--dark' : ''}`}
      viewBox="0 0 1200 730"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g className="hm-ground">
        {Array.from({ length: 13 }, (_, i) => (
          <g key={i}>
            <path d={`M${point(i - 2, -2)} L${point(i - 2, 10)}`} />
            <path d={`M${point(-2, i - 2)} L${point(10, i - 2)}`} />
          </g>
        ))}
      </g>
      <g className="hm-buildings">
        {towers.map(({ x, y, height: h }) => (
          <g key={`${x}-${y}`}>
            <polygon
              className="hm-building-side"
              points={polygon([
                [x, y, 0],
                [x + 0.7, y, 0],
                [x + 0.7, y, h],
                [x, y, h],
              ])}
            />
            <polygon
              className="hm-building-front"
              points={polygon([
                [x, y, 0],
                [x, y + 0.7, 0],
                [x, y + 0.7, h],
                [x, y, h],
              ])}
            />
            <polygon
              className="hm-building-top"
              points={polygon([
                [x, y, h],
                [x + 0.7, y, h],
                [x + 0.7, y + 0.7, h],
                [x, y + 0.7, h],
              ])}
            />
            <path
              d={`M${point(x + 0.7, y, h)} L${point(x + 0.7, y + 0.7, h)} L${point(x, y + 0.7, h)} M${point(x + 0.7, y + 0.7, h)} L${point(x + 0.7, y + 0.7)}`}
            />
            {h > 70 && (
              <path
                className="hm-building-floor"
                d={`M${point(x, y + 0.7, h * 0.5)} L${point(x, y, h * 0.5)} L${point(x + 0.7, y, h * 0.5)}`}
              />
            )}
          </g>
        ))}
      </g>
      <g className="hm-flow-paths">
        <path d={`M${point(-2, 4.35)} L${point(3.35, 4.35)} L${point(3.35, -2)}`} />
        <path d={`M${point(3.35, 10)} L${point(3.35, 4.35)} L${point(10, 4.35)}`} />
        <path d={`M${point(3.35, -2)} L${point(3.35, 4.35)} L${point(-2, 4.35)}`} />
      </g>
      <g className="hm-hub" transform={`translate(${project(3.35, 4.35).join(' ')})`}>
        <ellipse rx="110" ry="55" />
        <ellipse rx="80" ry="40" />
        <ellipse className="hm-hub-pulse" rx="49" ry="24.5" />
        <path d="M0,-90 L30,-75 L30,-35 L0,-20 L-30,-35 L-30,-75 Z M0,-90 L0,-50 M-30,-75 L0,-50 L30,-75 M0,-50 L0,-20" />
        <circle cy="-55" r="5" className="hm-hub-core" />
      </g>
      <g className="hm-scene-nodes">
        {[
          [1, 4.35],
          [3.35, 1],
          [6, 4.35],
          [3.35, 7],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${project(x!, y!).join(' ')})`}>
            <ellipse rx="12" ry="6" />
            <circle r="3" />
          </g>
        ))}
      </g>
    </svg>
  );
}
