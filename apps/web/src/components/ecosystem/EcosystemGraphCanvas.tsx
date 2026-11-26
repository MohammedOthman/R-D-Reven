'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Crosshair, Maximize2, Minus, Plus } from 'lucide-react';
import type { EcosystemGraph, GraphEdge, GraphNode } from '@/src/lib/ecosystem/types';
import { companyMonogram, computeHubIds, groupTone } from './ecosystem-visuals';

const WIDTH = 1000;
const HEIGHT = 660;
const MIN_VIEW_W = 280;
const MAX_VIEW_W = WIDTH;
const DEFAULT_VIEW: ViewBox = { x: 0, y: 0, w: WIDTH, h: HEIGHT };

type ViewBox = { x: number; y: number; w: number; h: number };
export type GraphLens = 'focus' | 'full';

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function nodeRadius(node: GraphNode): number {
  return Math.round((12 + 4.4 * Math.log10((node.headcount ?? 50) + 1)) * 10) / 10;
}

function shortLabel(value: string): string {
  return value.length > 18 ? `${value.slice(0, 17)}…` : value;
}

function clampView(view: ViewBox): ViewBox {
  const w = Math.min(MAX_VIEW_W, Math.max(MIN_VIEW_W, view.w));
  const h = (w / WIDTH) * HEIGHT;
  const padX = w * 0.28;
  const padY = h * 0.28;
  const x = Math.min(WIDTH - w + padX, Math.max(-padX, view.x));
  const y = Math.min(HEIGHT - h + padY, Math.max(-padY, view.y));
  return { x, y, w, h };
}

function arcGeometry(x1: number, y1: number, x2: number, y2: number, key: string) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  // Deterministic sign so arcs curve gracefully without oscillating
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const sign = hash % 2 === 0 ? 1 : -1;
  const offset = Math.min(44, Math.max(12, dist * 0.14)) * sign;
  const nx = -dy / dist;
  const ny = dx / dist;
  const cx = (x1 + x2) / 2 + nx * offset;
  const cy = (y1 + y2) / 2 + ny * offset;
  // Exact quadratic Bezier point at t = 0.5
  const mx = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
  const my = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
  return {
    d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    mx,
    my,
  };
}

const NO_DRAGGED_POSITIONS: Record<string, { x: number; y: number }> = {};

/**
 * Map between client pixels and viewBox units for an SVG using the default
 * preserveAspectRatio (xMidYMid meet). When CSS min-height makes the element taller
 * than the viewBox aspect, the drawing sits in a centred band, so a plain
 * rect-relative ratio would drift vertically.
 */
function viewportFit(rect: { width: number; height: number }, view: ViewBox) {
  const scale = Math.min(rect.width / view.w, rect.height / view.h);
  return {
    scale,
    offsetX: (rect.width - view.w * scale) / 2,
    offsetY: (rect.height - view.h * scale) / 2,
  };
}

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener?.('change', callback);
  return () => media.removeEventListener?.('change', callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function EcosystemGraphCanvas({
  graph,
  selectedId,
  comparedId,
  filteredIds,
  group,
  focusRequest,
  onSelect,
  onCompareEdge,
  onResetFilters,
}: {
  graph: EcosystemGraph;
  selectedId: string | null;
  comparedId: string | null;
  filteredIds: ReadonlySet<string>;
  group: number | 'all';
  focusRequest?: { id: string; nonce: number } | null;
  onSelect: (id: string) => void;
  onCompareEdge: (sourceId: string, targetId: string) => void;
  onResetFilters?: () => void;
}) {
  const t = useTranslations('ecosystem');
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number | null>(null);
  const viewRef = useRef<ViewBox>(DEFAULT_VIEW);

  const [view, setView] = useState<ViewBox>(DEFAULT_VIEW);
  const [lens, setLens] = useState<GraphLens>('focus');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  // Hover is tied to the filter it was set under, so an arc whose hit path unmounted
  // mid-hover (no mouseleave) does not come back highlighted after the filter changes.
  const [hoveredEdge, setHoveredEdge] = useState<{
    key: string;
    ids: ReadonlySet<string>;
  } | null>(null);
  const hoveredEdgeKey = hoveredEdge && hoveredEdge.ids === filteredIds ? hoveredEdge.key : null;
  // Dragged positions belong to one graph build; a rebuild or seed resets them.
  const graphVersion = graph.provenance.refreshedAt;
  const [dragState, setDragState] = useState<{
    version: string;
    positions: Record<string, { x: number; y: number }>;
  }>({ version: graphVersion, positions: {} });
  const draggedPositions =
    dragState.version === graphVersion ? dragState.positions : NO_DRAGGED_POSITIONS;

  const panDrag = useRef<{
    pointerX: number;
    pointerY: number;
    viewX: number;
    viewY: number;
    clientWidth: number;
  } | null>(null);

  const nodeDrag = useRef<{
    id: string;
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  // Rendered SVG size, used to place the hover card inside the letterboxed drawing band
  const [svgSize, setSvgSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSvgSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keep viewRef synced for smooth rAF camera transitions
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // Cancel any in-flight camera animation on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const cancelAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const animateViewTo = useCallback(
    (target: ViewBox) => {
      cancelAnimation();
      const clamped = clampView(target);
      const from = viewRef.current;

      if (reducedMotion || typeof requestAnimationFrame !== 'function') {
        rafRef.current =
          typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame(() => {
                rafRef.current = null;
                viewRef.current = clamped;
                setView(clamped);
              })
            : null;
        if (rafRef.current === null) {
          viewRef.current = clamped;
          setView(clamped);
        }
        return;
      }

      const duration = 220;
      const startTime = performance.now();

      const step = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration);
        // Smooth cubic-out ease matching cubic-bezier(0.2, 0.8, 0.2, 1)
        const eased = 1 - Math.pow(1 - progress, 3);
        const next: ViewBox = {
          x: from.x + (clamped.x - from.x) * eased,
          y: from.y + (clamped.y - from.y) * eased,
          w: from.w + (clamped.w - from.w) * eased,
          h: from.h + (clamped.h - from.h) * eased,
        };
        viewRef.current = next;
        setView(next);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [cancelAnimation, reducedMotion],
  );

  // Precompute all graph lookups with Map / Set for O(1) render access
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );

  const groupById = useMemo(
    () => new Map(graph.groups.map((entry) => [entry.id, entry])),
    [graph.groups],
  );

  const hubIds = useMemo(() => computeHubIds(graph.nodes), [graph.nodes]);

  const adjacency = useMemo(() => {
    const map = new Map<string, Map<string, GraphEdge>>();
    for (const node of graph.nodes) {
      map.set(node.id, new Map());
    }
    for (const edge of graph.edges) {
      if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
      map.get(edge.source)?.set(edge.target, edge);
      map.get(edge.target)?.set(edge.source, edge);
    }
    return map;
  }, [graph.nodes, graph.edges, nodeById]);

  const positionOf = useCallback(
    (node: GraphNode) => draggedPositions[node.id] ?? { x: node.x, y: node.y },
    [draggedPositions],
  );

  const activeAnchorId = hoveredNodeId ?? selectedId;

  // 1-hop neighbours & 2nd-degree warm bridge paths from the active anchor
  const { directNeighbourIds, secondDegreeByNode, secondDegreeEdgeKeys } = useMemo(() => {
    const direct = new Set<string>();
    const secondMap = new Map<string, { viaId: string; viaName: string }>();
    const bridgeEdges = new Set<string>();

    if (!activeAnchorId) {
      return {
        directNeighbourIds: direct,
        secondDegreeByNode: secondMap,
        secondDegreeEdgeKeys: bridgeEdges,
      };
    }

    const firstHop = adjacency.get(activeAnchorId);
    if (firstHop) {
      for (const neighbourId of firstHop.keys()) {
        direct.add(neighbourId);
      }
      for (const neighbourId of firstHop.keys()) {
        const viaNode = nodeById.get(neighbourId);
        const secondHop = adjacency.get(neighbourId);
        if (!secondHop || !viaNode) continue;
        for (const candidateId of secondHop.keys()) {
          if (candidateId === activeAnchorId || direct.has(candidateId)) continue;
          bridgeEdges.add(edgeKey(neighbourId, candidateId));
          if (!secondMap.has(candidateId)) {
            secondMap.set(candidateId, { viaId: neighbourId, viaName: viaNode.name });
          }
        }
      }
    }

    return {
      directNeighbourIds: direct,
      secondDegreeByNode: secondMap,
      secondDegreeEdgeKeys: bridgeEdges,
    };
  }, [activeAnchorId, adjacency, nodeById]);

  // 2nd-degree reach specifically relative to the selected company (for hover preview card)
  const selectedReach = useMemo(() => {
    const direct = new Map<string, GraphEdge>();
    const twoStep = new Map<string, string>();
    if (!selectedId) return { direct, twoStep };
    const firstHop = adjacency.get(selectedId);
    if (!firstHop) return { direct, twoStep };
    for (const [id, edge] of firstHop) {
      direct.set(id, edge);
    }
    for (const [viaId] of firstHop) {
      const viaName = nodeById.get(viaId)?.name ?? '';
      const secondHop = adjacency.get(viaId);
      if (!secondHop) continue;
      for (const candidateId of secondHop.keys()) {
        if (candidateId !== selectedId && !direct.has(candidateId) && !twoStep.has(candidateId)) {
          twoStep.set(candidateId, viaName);
        }
      }
    }
    return { direct, twoStep };
  }, [selectedId, adjacency, nodeById]);

  const comparedEdgeKey = selectedId && comparedId ? edgeKey(selectedId, comparedId) : null;

  // Group territories computed from live positions
  const territories = useMemo(() => {
    return graph.groups
      .map((entry) => {
        const members = graph.nodes.filter((node) => node.group === entry.id);
        if (members.length === 0) return null;
        const pts = members.map((node) => positionOf(node));
        const cx = pts.reduce((sum, pt) => sum + pt.x, 0) / pts.length;
        const cy = pts.reduce((sum, pt) => sum + pt.y, 0) / pts.length;
        const radius = Math.max(...pts.map((pt) => Math.hypot(pt.x - cx, pt.y - cy))) + 64;
        return {
          id: entry.id,
          label: entry.label,
          cx,
          cy,
          radius,
          tone: groupTone(entry.id),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [graph.groups, graph.nodes, positionOf]);

  // Helper to compute a camera box framing a set of nodes
  const frameNodes = useCallback(
    (nodes: readonly GraphNode[], padding = 110) => {
      if (nodes.length === 0) {
        animateViewTo(DEFAULT_VIEW);
        return;
      }
      if (nodes.length === 1) {
        const pt = positionOf(nodes[0]!);
        const w = 480;
        const h = (w / WIDTH) * HEIGHT;
        animateViewTo({ x: pt.x - w / 2, y: pt.y - h / 2, w, h });
        return;
      }
      const pts = nodes.map((n) => positionOf(n));
      const minX = Math.min(...pts.map((p) => p.x)) - padding;
      const maxX = Math.max(...pts.map((p) => p.x)) + padding;
      const minY = Math.min(...pts.map((p) => p.y)) - padding;
      const maxY = Math.max(...pts.map((p) => p.y)) + padding;
      const boxW = Math.max(MIN_VIEW_W, maxX - minX);
      const boxH = Math.max((MIN_VIEW_W / WIDTH) * HEIGHT, maxY - minY);
      const scale = Math.max(boxW / WIDTH, boxH / HEIGHT);
      const w = Math.min(MAX_VIEW_W, WIDTH * scale);
      const h = (w / WIDTH) * HEIGHT;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      animateViewTo({ x: cx - w / 2, y: cy - h / 2, w, h });
    },
    [animateViewTo, positionOf],
  );

  // Auto-frame when switching group pills
  const previousGroupRef = useRef<number | 'all'>(group);
  useEffect(() => {
    if (previousGroupRef.current === group) return;
    previousGroupRef.current = group;
    if (group === 'all') {
      animateViewTo(DEFAULT_VIEW);
    } else {
      const members = graph.nodes.filter((node) => node.group === group);
      frameNodes(members, 120);
    }
  }, [group, graph.nodes, animateViewTo, frameNodes]);

  // Smooth glide when inspector quick-focus requests focusing a company
  const lastFocusNonceRef = useRef<number>(0);
  useEffect(() => {
    if (!focusRequest || focusRequest.nonce === lastFocusNonceRef.current) return;
    lastFocusNonceRef.current = focusRequest.nonce;
    const node = nodeById.get(focusRequest.id);
    if (!node) return;
    const pt = positionOf(node);
    const current = viewRef.current;
    const targetW = Math.min(current.w, 560);
    const targetH = (targetW / WIDTH) * HEIGHT;
    animateViewTo({ x: pt.x - targetW / 2, y: pt.y - targetH / 2, w: targetW, h: targetH });
  }, [focusRequest, nodeById, positionOf, animateViewTo]);

  // Ctrl / Cmd + wheel zoom without hijacking normal page scroll
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      cancelAnimation();
      const rect = (svgRef.current ?? el).getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const factor = event.deltaY < 0 ? 1.16 : 0.86;
      setView((current) => {
        const fit = viewportFit(rect, current);
        const relX = Math.min(
          1,
          Math.max(0, (event.clientX - rect.left - fit.offsetX) / (current.w * fit.scale)),
        );
        const relY = Math.min(
          1,
          Math.max(0, (event.clientY - rect.top - fit.offsetY) / (current.h * fit.scale)),
        );
        const nextW = Math.min(MAX_VIEW_W, Math.max(MIN_VIEW_W, current.w / factor));
        const nextH = (nextW / WIDTH) * HEIGHT;
        const anchorX = current.x + relX * current.w;
        const anchorY = current.y + relY * current.h;
        return clampView({
          x: anchorX - relX * nextW,
          y: anchorY - relY * nextH,
          w: nextW,
          h: nextH,
        });
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [cancelAnimation]);

  const zoomBy = (factor: number) => {
    const current = viewRef.current;
    const nextW = Math.min(MAX_VIEW_W, Math.max(MIN_VIEW_W, current.w / factor));
    const nextH = (nextW / WIDTH) * HEIGHT;
    animateViewTo({
      x: current.x + (current.w - nextW) / 2,
      y: current.y + (current.h - nextH) / 2,
      w: nextW,
      h: nextH,
    });
  };

  const centerOnSelected = () => {
    if (!selectedId) return;
    const node = nodeById.get(selectedId);
    if (!node) return;
    const pt = positionOf(node);
    const current = viewRef.current;
    const targetW = Math.min(current.w, 540);
    const targetH = (targetW / WIDTH) * HEIGHT;
    animateViewTo({ x: pt.x - targetW / 2, y: pt.y - targetH / 2, w: targetW, h: targetH });
  };

  const fitMap = () => {
    if (group !== 'all') {
      const members = graph.nodes.filter((node) => node.group === group);
      frameNodes(members, 120);
    } else {
      animateViewTo(DEFAULT_VIEW);
    }
  };

  // Pointer handling for both canvas panning and direct node dragging
  const handleSvgPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const targetEl = event.target as Element;
    if (targetEl.closest('[data-node]') || targetEl.closest('[data-edge]')) return;
    cancelAnimation();
    panDrag.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      viewX: viewRef.current.x,
      viewY: viewRef.current.y,
      clientWidth: svgRef.current?.getBoundingClientRect().width || WIDTH,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleNodePointerDown = (event: ReactPointerEvent<SVGGElement>, node: GraphNode) => {
    event.stopPropagation();
    cancelAnimation();
    const pt = positionOf(node);
    nodeDrag.current = {
      id: node.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: pt.x,
      startY: pt.y,
      moved: false,
    };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const handleSvgPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (nodeDrag.current) {
      const rectWidth = svgRef.current?.getBoundingClientRect().width || WIDTH;
      const scale = viewRef.current.w / rectWidth;
      const dxPx = event.clientX - nodeDrag.current.pointerX;
      const dyPx = event.clientY - nodeDrag.current.pointerY;
      if (!nodeDrag.current.moved && Math.hypot(dxPx, dyPx) > 4) {
        nodeDrag.current.moved = true;
      }
      if (nodeDrag.current.moved) {
        const nextX = Math.min(WIDTH - 40, Math.max(40, nodeDrag.current.startX + dxPx * scale));
        const nextY = Math.min(HEIGHT - 40, Math.max(40, nodeDrag.current.startY + dyPx * scale));
        const draggedId = nodeDrag.current.id;
        setDragState((prev) => ({
          version: graphVersion,
          positions: {
            ...(prev.version === graphVersion ? prev.positions : {}),
            [draggedId]: { x: nextX, y: nextY },
          },
        }));
      }
      return;
    }

    if (!panDrag.current) return;
    const scale = viewRef.current.w / panDrag.current.clientWidth;
    setView((current) =>
      clampView({
        ...current,
        x: panDrag.current!.viewX - (event.clientX - panDrag.current!.pointerX) * scale,
        y: panDrag.current!.viewY - (event.clientY - panDrag.current!.pointerY) * scale,
      }),
    );
  };

  const handleSvgPointerUp = () => {
    if (nodeDrag.current) {
      const { id, moved } = nodeDrag.current;
      nodeDrag.current = null;
      if (!moved) {
        onSelect(id);
      }
    }
    panDrag.current = null;
  };

  const handleBackgroundDoubleClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    const targetEl = event.target as Element;
    if (targetEl.closest('[data-node]') || targetEl.closest('[data-edge]')) return;
    fitMap();
  };

  const handleMinimapClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const targetCenterX = relX * WIDTH;
    const targetCenterY = relY * HEIGHT;
    const current = viewRef.current;
    animateViewTo({
      x: targetCenterX - current.w / 2,
      y: targetCenterY - current.h / 2,
      w: current.w,
      h: current.h,
    });
  };

  // Precompute arc geometry for all edges so midpoint badges and lines stay in sync
  const renderedEdges = useMemo(() => {
    return graph.edges
      .map((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) return null;
        const p1 = positionOf(source);
        const p2 = positionOf(target);
        const key = edgeKey(edge.source, edge.target);
        const geom = arcGeometry(p1.x, p1.y, p2.x, p2.y, key);
        const isDirect =
          activeAnchorId !== null &&
          (edge.source === activeAnchorId || edge.target === activeAnchorId);
        const isBridge = !isDirect && secondDegreeEdgeKeys.has(key);
        const isCompared = comparedEdgeKey === key;
        const isHovered = hoveredEdgeKey === key;
        const bothVisible = filteredIds.has(edge.source) && filteredIds.has(edge.target);
        return {
          edge,
          key,
          source,
          target,
          geom,
          isDirect,
          isBridge,
          isCompared,
          isHovered,
          bothVisible,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [
    graph.edges,
    nodeById,
    positionOf,
    activeAnchorId,
    secondDegreeEdgeKeys,
    comparedEdgeKey,
    hoveredEdgeKey,
    filteredIds,
  ]);

  // Midpoint badges to display (compared arc + hovered arc if distinct)
  const midpointBadges = useMemo(() => {
    return renderedEdges.filter((item) => (item.isCompared || item.isHovered) && item.bothVisible);
  }, [renderedEdges]);

  // Floating hover preview card info + in-bounds percentage coordinates
  const hoveredCard = useMemo(() => {
    if (!hoveredNodeId) return null;
    const node = nodeById.get(hoveredNodeId);
    if (!node) return null;
    const pt = positionOf(node);
    let relX = (pt.x - view.x) / view.w;
    let relY = (pt.y - view.y) / view.h;
    if (svgSize && svgSize.width && svgSize.height) {
      const fit = viewportFit(svgSize, view);
      relX = (fit.offsetX + (pt.x - view.x) * fit.scale) / svgSize.width;
      relY = (fit.offsetY + (pt.y - view.y) * fit.scale) / svgSize.height;
    }
    const leftPct = Math.min(72, Math.max(4, relX * 100 + (relX > 0.65 ? -26 : 3)));
    const topPct = Math.min(72, Math.max(12, relY * 100 - 8));
    const directEdge = selectedReach.direct.get(node.id);
    const viaName = selectedReach.twoStep.get(node.id);
    const connectionCount = adjacency.get(node.id)?.size ?? 0;
    const groupEntry = groupById.get(node.group);
    return {
      node,
      leftPct,
      topPct,
      directScore: directEdge ? Math.round(directEdge.score * 100) : null,
      viaName: viaName ?? null,
      connectionCount,
      groupLabel: groupEntry?.label ?? `${t('group')} ${node.group + 1}`,
      tone: groupTone(node.group),
    };
  }, [hoveredNodeId, nodeById, positionOf, view, svgSize, selectedReach, adjacency, groupById, t]);

  const isZoomedIn = view.w < WIDTH * 0.92;
  const noMatches = graph.nodes.length > 0 && filteredIds.size === 0;

  return (
    <div className="eco-stage-shell">
      <div ref={stageRef} className="eco-stage-viewport">
        {/* Top Stage Chrome: Focus / Full map lens + Spatial Controls */}
        <div className="eco-stage-chrome-top">
          <div className="eco-lens-group" role="group" aria-label={t('lensLabel')}>
            <button
              type="button"
              className="eco-lens-btn"
              aria-pressed={lens === 'focus'}
              onClick={() => setLens('focus')}
            >
              {t('lensFocus')}
            </button>
            <button
              type="button"
              className="eco-lens-btn"
              aria-pressed={lens === 'full'}
              onClick={() => setLens('full')}
            >
              {t('lensFull')}
            </button>
          </div>

          <div className="eco-controls-group">
            <button
              type="button"
              className="eco-icon-btn"
              onClick={() => zoomBy(1.3)}
              aria-label={t('zoomIn')}
              title={t('zoomIn')}
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="eco-icon-btn"
              onClick={() => zoomBy(0.77)}
              aria-label={t('zoomOut')}
              title={t('zoomOut')}
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="eco-icon-btn"
              onClick={centerOnSelected}
              disabled={!selectedId}
              aria-label={t('centerSelected')}
              title={t('centerSelected')}
            >
              <Crosshair className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="eco-icon-btn"
              onClick={fitMap}
              aria-label={t('fitMap')}
              title={t('fitMap')}
            >
              <Maximize2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Main Interactive Constellation SVG */}
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className="eco-stage-svg"
          role="group"
          aria-label={t('graphLabel')}
          data-lens={lens}
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerCancel={handleSvgPointerUp}
          onDoubleClick={handleBackgroundDoubleClick}
        >
          <defs>
            {/* Single emphasis aura for the selected company only (Brand System rule) */}
            <radialGradient id="eco-selected-aura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2C5BFF" stopOpacity="0.46" />
              <stop offset="55%" stopColor="#2C5BFF" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#2C5BFF" stopOpacity="0" />
            </radialGradient>

            {territories.map((territory) => (
              <radialGradient
                key={`grad-${territory.id}`}
                id={`eco-terr-${territory.id}`}
                cx="50%"
                cy="50%"
                r="50%"
              >
                <stop offset="0%" stopColor={territory.tone.territory} stopOpacity="0.14" />
                <stop offset="72%" stopColor={territory.tone.territory} stopOpacity="0.045" />
                <stop offset="100%" stopColor={territory.tone.territory} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          {/* Soft Radial Group Territories + Mono Uppercase Territory Labels */}
          <g pointerEvents="none">
            {territories.map((territory) => {
              const territoryDimmed = group !== 'all' && group !== territory.id;
              return (
                <g
                  key={`territory-${territory.id}`}
                  opacity={territoryDimmed ? 0.22 : 1}
                  data-territory={territory.id}
                >
                  <circle
                    cx={territory.cx}
                    cy={territory.cy}
                    r={territory.radius}
                    fill={`url(#eco-terr-${territory.id})`}
                    stroke={territory.tone.territory}
                    strokeOpacity={0.18}
                    strokeWidth={1}
                    strokeDasharray="3 6"
                  />
                  <text
                    x={territory.cx}
                    y={Math.max(22, territory.cy - territory.radius + 18)}
                    textAnchor="middle"
                    className="eco-territory-label"
                  >
                    {territory.label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Curved Quadratic Bezier Arcs */}
          <g>
            {renderedEdges.map(
              ({
                edge,
                key,
                source,
                target,
                geom,
                isDirect,
                isBridge,
                isCompared,
                isHovered,
                bothVisible,
              }) => {
                const isFocusLens = lens === 'focus' && activeAnchorId !== null;
                let stroke = '#64748B';
                let strokeOpacity = 0.24;
                let strokeWidth = 1.1 + edge.score * 2.2;
                let dashArray: string | undefined;

                if (!bothVisible) {
                  strokeOpacity = 0.05;
                } else if (isCompared || isHovered) {
                  stroke = '#5B7EFF';
                  strokeOpacity = 0.95;
                  strokeWidth = 2.4 + edge.score * 2.4;
                } else if (isDirect) {
                  stroke = '#2C5BFF';
                  strokeOpacity = 0.72;
                  strokeWidth = 1.6 + edge.score * 2.4;
                } else if (isBridge) {
                  stroke = '#8FA4C8';
                  strokeOpacity = isFocusLens ? 0.42 : 0.34;
                  strokeWidth = 1.25;
                  dashArray = '4 5';
                } else if (isFocusLens) {
                  stroke = '#475569';
                  strokeOpacity = 0.07;
                  strokeWidth = 1;
                } else {
                  stroke = '#8FA4C8';
                  strokeOpacity = 0.28;
                  strokeWidth = 1.1 + edge.score * 2;
                }

                const scorePct = Math.round(edge.score * 100);
                const showBead =
                  !reducedMotion && bothVisible && (isCompared || isHovered || isDirect);

                return (
                  <g key={key}>
                    {/* Base curved arc */}
                    <path
                      d={geom.d}
                      fill="none"
                      stroke={stroke}
                      strokeOpacity={strokeOpacity}
                      strokeWidth={strokeWidth}
                      strokeDasharray={dashArray}
                      strokeLinecap="round"
                      className="eco-arc"
                      data-edge-kind={
                        isCompared
                          ? 'compared'
                          : isDirect
                            ? 'direct'
                            : isBridge
                              ? 'bridge'
                              : 'ambient'
                      }
                    />

                    {/* Flowing signal dashes on active / compared arc */}
                    {bothVisible && (isCompared || isHovered) && (
                      <path
                        d={geom.d}
                        fill="none"
                        stroke="#AEC5FF"
                        strokeOpacity={0.85}
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        className="eco-arc-flow"
                        pointerEvents="none"
                      />
                    )}

                    {/* Traveling SVG light-bead along active/compared arcs */}
                    {showBead && (
                      <circle
                        r={isCompared || isHovered ? 3.1 : 2.1}
                        fill={isCompared || isHovered ? '#FFFFFF' : '#AEC5FF'}
                        fillOpacity={isCompared || isHovered ? 0.95 : 0.75}
                        pointerEvents="none"
                      >
                        <animateMotion
                          dur={isCompared || isHovered ? '2.4s' : '3.6s'}
                          repeatCount="indefinite"
                          path={geom.d}
                        />
                      </circle>
                    )}

                    {/* Generous interactive hit path for clicking connections */}
                    {bothVisible && (
                      <path
                        d={geom.d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                        className="cursor-pointer outline-none"
                        data-edge={key}
                        role="button"
                        tabIndex={-1}
                        aria-label={t('inspectConnection', {
                          source: source.name,
                          target: target.name,
                          score: scorePct,
                        })}
                        onMouseEnter={() => setHoveredEdge({ key, ids: filteredIds })}
                        onMouseLeave={() => setHoveredEdge(null)}
                        onFocus={() => setHoveredEdge({ key, ids: filteredIds })}
                        onBlur={() => setHoveredEdge(null)}
                        onClick={(event) => {
                          event.stopPropagation();
                          onCompareEdge(edge.source, edge.target);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onCompareEdge(edge.source, edge.target);
                          }
                        }}
                      />
                    )}
                  </g>
                );
              },
            )}
          </g>

          {/* Architectural Nodes */}
          <g>
            {graph.nodes.map((node) => {
              const pt = positionOf(node);
              const radius = nodeRadius(node);
              const tone = groupTone(node.group);
              const isSelected = node.id === selectedId;
              const isHovered = node.id === hoveredNodeId;
              const isHub = hubIds.has(node.id);
              const isVisible = filteredIds.has(node.id);
              const isDirect = directNeighbourIds.has(node.id);
              const isSecondDegree = secondDegreeByNode.has(node.id);
              const isFocusLens = lens === 'focus' && activeAnchorId !== null;

              const dimmed =
                !isVisible ||
                (isFocusLens &&
                  !isSelected &&
                  node.id !== activeAnchorId &&
                  !isDirect &&
                  !isSecondDegree);

              const subtleBridge = isFocusLens && isSecondDegree && !isSelected && !isHovered;

              const labelText = shortLabel(node.name);
              const pillWidth = Math.max(54, Math.min(144, labelText.length * 7.1 + 18));
              const monogram = companyMonogram(node.name);

              const ariaLabel = node.headcount
                ? `${node.name}, ${t('employees', { count: node.headcount })}`
                : node.name;

              return (
                <g
                  key={node.id}
                  data-node={node.id}
                  transform={`translate(${pt.x} ${pt.y})`}
                  className="eco-node-group"
                  opacity={dimmed ? 0.22 : subtleBridge ? 0.78 : 1}
                  role="button"
                  tabIndex={isVisible ? 0 : -1}
                  aria-label={ariaLabel}
                  aria-pressed={isSelected}
                  aria-disabled={isVisible ? undefined : true}
                  pointerEvents={isVisible ? undefined : 'none'}
                  onPointerDown={(event) => {
                    if (isVisible) handleNodePointerDown(event, node);
                  }}
                  onClick={(event) => {
                    // Keyboard/programmatic clicks (mouse clicks are handled on pointerUp when not dragging)
                    if (isVisible && event.detail === 0) onSelect(node.id);
                  }}
                  onKeyDown={(event) => {
                    if (isVisible && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      onSelect(node.id);
                    }
                  }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onFocus={() => setHoveredNodeId(node.id)}
                  onBlur={() => setHoveredNodeId(null)}
                >
                  <title>{node.name}</title>

                  {/* Single glowing emphasis aura + breathing focus ring on selected company only */}
                  {isSelected && (
                    <>
                      <circle r={radius + 26} fill="url(#eco-selected-aura)" pointerEvents="none" />
                      <circle
                        r={radius + 9}
                        fill="none"
                        stroke="#8DA4FF"
                        strokeWidth={1.6}
                        className="eco-breathe-ring"
                        pointerEvents="none"
                      />
                    </>
                  )}

                  {/* Subtle dashed orbital ring on top-centrality hubs */}
                  {isHub && (
                    <circle
                      r={radius + 5.5}
                      fill="none"
                      stroke={isSelected ? '#AEC5FF' : '#8DA4FF'}
                      strokeOpacity={isSelected ? 0.9 : 0.52}
                      strokeWidth={1.25}
                      strokeDasharray="3 4"
                      pointerEvents="none"
                    />
                  )}

                  {/* Main company circle */}
                  <circle
                    r={radius}
                    fill={tone.fill}
                    stroke={isSelected ? '#FFFFFF' : isHovered ? '#AEC5FF' : '#0F1629'}
                    strokeWidth={isSelected ? 2.6 : 2}
                    className="eco-node-circle"
                  />

                  {/* 2-letter company monogram */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={radius >= 19 ? 11 : 9.5}
                    className="eco-node-monogram"
                  >
                    {monogram}
                  </text>

                  {/* Dark translucent pill backdrop behind label so crossing arcs never reduce legibility */}
                  <g transform={`translate(0 ${radius + 17})`} pointerEvents="none">
                    <rect
                      x={-pillWidth / 2}
                      y={-11}
                      width={pillWidth}
                      height={22}
                      rx={10}
                      fill={isSelected ? 'rgba(44, 91, 255, 0.92)' : 'rgba(11, 17, 32, 0.86)'}
                      stroke={isSelected ? 'rgba(174, 197, 255, 0.7)' : 'rgba(148, 163, 184, 0.22)'}
                      strokeWidth={1}
                    />
                    <text
                      y={3.5}
                      textAnchor="middle"
                      className="eco-node-label"
                      style={{ direction: 'inherit' }}
                    >
                      {labelText}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>

          {/* Crisp Midpoint Match Percentage Pills at t = 0.5 of compared / hovered arc */}
          <g pointerEvents="none">
            {midpointBadges.map(({ key, edge, geom }) => {
              const pct = `${Math.round(edge.score * 100)}%`;
              return (
                <g
                  key={`badge-${key}`}
                  transform={`translate(${geom.mx} ${geom.my})`}
                  data-midpoint-badge="true"
                >
                  <rect
                    x={-21}
                    y={-11}
                    width={42}
                    height={22}
                    rx={11}
                    fill="#0B1120"
                    stroke="#2C5BFF"
                    strokeWidth={1.5}
                  />
                  <text y={3.5} textAnchor="middle" className="eco-midpoint-text">
                    {pct}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Floating Dark Glass Hover Preview Card */}
        {hoveredCard && (
          <div
            className="eco-hover-card"
            data-hover-card="true"
            style={{
              left: `${hoveredCard.leftPct}%`,
              top: `${hoveredCard.topPct}%`,
            }}
          >
            <p className="eco-hover-card-name">{hoveredCard.node.name}</p>
            <div className="eco-hover-card-meta">
              <span
                className="eco-group-dot"
                style={{ backgroundColor: hoveredCard.tone.fill }}
                aria-hidden="true"
              />
              <span>{hoveredCard.groupLabel}</span>
              {hoveredCard.node.hqCity && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{hoveredCard.node.hqCity}</span>
                </>
              )}
            </div>
            <div className="eco-hover-card-footer">
              <span>{t('connectionsCount', { count: hoveredCard.connectionCount })}</span>
              {hoveredCard.directScore !== null ? (
                <span className="eco-hover-badge">
                  {t('directMatchLabel', { score: hoveredCard.directScore })}
                </span>
              ) : hoveredCard.viaName !== null ? (
                <span className="eco-hover-badge eco-hover-badge--bridge">
                  {hoveredCard.viaName
                    ? t('twoStepVia', { name: hoveredCard.viaName })
                    : t('twoStepReach')}
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* Clickable Translucent Radar Minimap (appears when zoomed in) */}
        {isZoomedIn && (
          <div
            className="eco-minimap"
            data-minimap="true"
            role="button"
            tabIndex={0}
            aria-label={t('minimapLabel')}
            onClick={handleMinimapClick}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fitMap();
              }
            }}
          >
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
              {graph.edges.map((edge) => {
                const s = nodeById.get(edge.source);
                const tgt = nodeById.get(edge.target);
                if (!s || !tgt) return null;
                const p1 = positionOf(s);
                const p2 = positionOf(tgt);
                return (
                  <line
                    key={`mini-${edge.source}-${edge.target}`}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#64748B"
                    strokeOpacity={0.35}
                    strokeWidth={3}
                  />
                );
              })}
              {graph.nodes.map((node) => {
                const pt = positionOf(node);
                const isSel = node.id === selectedId;
                return (
                  <circle
                    key={`mini-node-${node.id}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={isSel ? 18 : 11}
                    fill={isSel ? '#FFFFFF' : groupTone(node.group).fill}
                    opacity={filteredIds.has(node.id) ? 0.95 : 0.25}
                  />
                );
              })}
              <rect
                x={view.x}
                y={view.y}
                width={view.w}
                height={view.h}
                rx={16}
                fill="rgba(44, 91, 255, 0.16)"
                stroke="#8DA4FF"
                strokeWidth={8}
              />
            </svg>
          </div>
        )}

        {/* Empty-filter overlay with Show all companies reset */}
        {noMatches && (
          <div className="eco-stage-empty-overlay">
            <h3>{t('noFilterMatchesTitle')}</h3>
            <p>{t('noFilterMatchesDescription')}</p>
            {onResetFilters && (
              <button type="button" className="eco-btn-hero-primary mt-2" onClick={onResetFilters}>
                {t('resetFilters')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quiet Stage Legend & Interaction Hint */}
      <div className="eco-stage-footer">
        <div className="eco-legend-items" aria-label={t('legendTitle')}>
          <span className="eco-legend-item">
            <span className="eco-legend-swatch-direct" aria-hidden="true" />
            {t('legendDirect')}
          </span>
          <span className="eco-legend-item">
            <span className="eco-legend-swatch-bridge" aria-hidden="true" />
            {t('legendBridge')}
          </span>
          <span className="eco-legend-item">
            <span className="eco-legend-swatch-hub" aria-hidden="true" />
            {t('legendHub')}
          </span>
        </div>
        <span className="eco-stage-hint">{t('dragHint')}</span>
      </div>
    </div>
  );
}
