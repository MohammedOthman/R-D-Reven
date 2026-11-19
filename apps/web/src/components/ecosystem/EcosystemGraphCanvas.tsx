'use client';

import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { EcosystemGraph, GraphNode } from '@/src/lib/ecosystem/types';

const WIDTH = 1000;
const HEIGHT = 680;

// Brand rule: blue is the only saturated hue (docs/brand). Groups use the
// accent, ink, muted gray and the two pale accents — never a new hue.
const GROUP_COLORS = ['#2c5bff', '#0f1629', '#6b7180', '#8da4ff', '#93610e'];

function nodeRadius(node: GraphNode): number {
  return 8 + 5 * Math.log10((node.headcount ?? 50) + 1);
}

function shortLabel(value: string): string {
  return value.length > 18 ? `${value.slice(0, 17)}…` : value;
}

export function EcosystemGraphCanvas({
  graph,
  selectedId,
  onSelect,
  query,
  group,
}: {
  graph: EcosystemGraph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  query: string;
  group: number | 'all';
}) {
  const t = useTranslations('ecosystem');
  const locale = useLocale();
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, w: WIDTH, h: HEIGHT });
  const drag = useRef<{
    pointerX: number;
    pointerY: number;
    viewX: number;
    viewY: number;
    clientWidth: number;
  } | null>(null);

  const focusId = hoveredId ?? selectedId;
  const normalizedQuery = query.trim().toLowerCase();
  const visible = (node: GraphNode) =>
    (group === 'all' || node.group === group) &&
    (!normalizedQuery || node.name.toLowerCase().includes(normalizedQuery));
  const connected = (node: GraphNode) =>
    !focusId ||
    node.id === focusId ||
    graph.edges.some(
      (edge) =>
        (edge.source === focusId || edge.target === focusId) &&
        (edge.source === node.id || edge.target === node.id),
    );

  const groupCentres = useMemo(() => {
    return graph.groups.map((entry) => {
      const members = graph.nodes.filter((node) => node.group === entry.id);
      if (!members.length) return null;
      const cx = members.reduce((sum, node) => sum + node.x, 0) / members.length;
      const cy = members.reduce((sum, node) => sum + node.y, 0) / members.length;
      const radius = Math.max(...members.map((node) => Math.hypot(node.x - cx, node.y - cy))) + 58;
      return { id: entry.id, cx, cy, radius };
    });
  }, [graph]);

  const zoom = (factor: number) => {
    setView((current) => {
      const nextWidth = Math.min(WIDTH, Math.max(320, current.w / factor));
      const nextHeight = (nextWidth / WIDTH) * HEIGHT;
      return {
        x: current.x + (current.w - nextWidth) / 2,
        y: current.y + (current.h - nextHeight) / 2,
        w: nextWidth,
        h: nextHeight,
      };
    });
  };

  const beginDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('[data-node]')) return;
    drag.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      viewX: view.x,
      viewY: view.y,
      clientWidth: svgRef.current?.getBoundingClientRect().width || WIDTH,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const scale = view.w / drag.current.clientWidth;
    setView((current) => ({
      ...current,
      x: drag.current!.viewX - (event.clientX - drag.current!.pointerX) * scale,
      y: drag.current!.viewY - (event.clientY - drag.current!.pointerY) * scale,
    }));
  };

  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="h-auto w-full cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label={t('graphLabel')}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {groupCentres.map((centre) =>
          centre ? (
            <circle
              key={centre.id}
              cx={centre.cx}
              cy={centre.cy}
              r={centre.radius}
              fill={GROUP_COLORS[centre.id % GROUP_COLORS.length]}
              fillOpacity={0.045}
              stroke={GROUP_COLORS[centre.id % GROUP_COLORS.length]}
              strokeOpacity={0.12}
              strokeWidth={1}
            />
          ) : null,
        )}

        <g pointerEvents="none">
          {graph.edges.map((edge) => {
            const sourceNode = graph.nodes.find((node) => node.id === edge.source);
            const targetNode = graph.nodes.find((node) => node.id === edge.target);
            if (!sourceNode || !targetNode) return null;
            const active = focusId !== null && (edge.source === focusId || edge.target === focusId);
            const muted =
              (focusId !== null && !active) || !visible(sourceNode) || !visible(targetNode);
            return (
              <line
                key={`${edge.source}-${edge.target}`}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={active ? '#2c5bff' : '#0f1629'}
                strokeOpacity={muted ? 0.07 : active ? 0.55 : 0.18}
                strokeWidth={1 + edge.score * 3.5}
              />
            );
          })}
        </g>

        {graph.nodes.map((node) => {
          const radius = nodeRadius(node);
          const color = GROUP_COLORS[node.group % GROUP_COLORS.length] ?? GROUP_COLORS[2]!;
          const dimmed = !visible(node) || !connected(node);
          const selected = node.id === selectedId;
          return (
            <g
              key={node.id}
              data-node
              transform={`translate(${node.x} ${node.y})`}
              className="cursor-pointer outline-none"
              role="button"
              tabIndex={0}
              aria-label={`${node.name}${
                node.headcount ? `, ${number.format(node.headcount)} employees` : ''
              }`}
              onClick={() => onSelect(node.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(node.id);
                }
              }}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setHoveredId(node.id)}
              onBlur={() => setHoveredId(null)}
            >
              <title>{node.name}</title>
              {selected && <circle r={radius + 7} fill="none" stroke="#2c5bff" strokeWidth={2.5} />}
              <circle
                r={radius}
                fill={color}
                fillOpacity={dimmed ? 0.18 : 1}
                stroke="#ffffff"
                strokeWidth={2}
              />
              <text
                y={radius + 17}
                textAnchor="middle"
                className="fill-[#0f1629] text-[13px] font-semibold"
                fillOpacity={dimmed ? 0.3 : 1}
                style={{ direction: 'inherit' }}
              >
                {shortLabel(node.name)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="bg-card absolute end-3 top-3 flex items-center gap-1 rounded-full border border-[var(--border-default)] p-1 shadow-xs">
        <button
          type="button"
          className="text-muted-body hover:text-ink flex size-8 items-center justify-center rounded-full"
          onClick={() => zoom(1.3)}
          aria-label={t('zoomIn')}
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="text-muted-body hover:text-ink flex size-8 items-center justify-center rounded-full"
          onClick={() => zoom(0.77)}
          aria-label={t('zoomOut')}
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="text-muted-body hover:text-ink flex size-8 items-center justify-center rounded-full"
          onClick={() => setView({ x: 0, y: 0, w: WIDTH, h: HEIGHT })}
          aria-label={t('resetView')}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
