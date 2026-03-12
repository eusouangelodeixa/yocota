import * as React from "react";
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/formatters";
import {
  ZoomIn, ZoomOut, Maximize2, Move, X, ExternalLink,
  ArrowRight, Package, DollarSign, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Offer {
  id: string;
  name: string;
  product_id: string;
  accept_next_offer_id: string | null;
  reject_next_offer_id: string | null;
  page_url?: string | null;
  products?: { name: string; price: number; currency?: string } | null;
}

interface OfferFunnelTreeProps {
  offers: Offer[];
}

/* ------------------------------------------------------------------ */
/*  Layout engine                                                      */
/* ------------------------------------------------------------------ */
const NODE_W = 230;
const NODE_H = 110;
const H_GAP = 80;
const V_GAP = 120;
const END_W = 100;
const END_H = 36;

interface LayoutNode {
  id: string;
  offer: Offer;
  x: number;
  y: number;
  isLoop?: boolean;
  isRoot?: boolean;
  children: { node: LayoutNode; type: "accept" | "reject" }[];
}

interface Edge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  type: "accept" | "reject";
  toLoop?: boolean;
  toEnd?: boolean;
  fromId: string;
  toId: string;
}

// Determine node "type" for color coding
function getNodeType(offer: Offer, isRoot: boolean): "root" | "upsell" | "downsell" {
  if (isRoot) return "root";
  // If name contains downsell/down, mark as downsell
  const lower = offer.name.toLowerCase();
  if (lower.includes("down")) return "downsell";
  return "upsell";
}

const nodeColors = {
  root: {
    border: "border-[hsl(var(--info))]",
    bg: "bg-[hsl(var(--info)/0.08)]",
    glow: "shadow-[0_0_20px_hsl(var(--info)/0.15)]",
    dot: "bg-[hsl(var(--info))]",
    label: "Início",
    labelColor: "text-[hsl(var(--info))]",
  },
  upsell: {
    border: "border-[hsl(var(--success))]",
    bg: "bg-[hsl(var(--success)/0.06)]",
    glow: "shadow-[0_0_20px_hsl(var(--success)/0.12)]",
    dot: "bg-[hsl(var(--success))]",
    label: "Upsell",
    labelColor: "text-[hsl(var(--success))]",
  },
  downsell: {
    border: "border-[hsl(var(--warning))]",
    bg: "bg-[hsl(var(--warning)/0.06)]",
    glow: "shadow-[0_0_20px_hsl(var(--warning)/0.12)]",
    dot: "bg-[hsl(var(--warning))]",
    label: "Downsell",
    labelColor: "text-[hsl(var(--warning))]",
  },
};

function buildTree(
  offer: Offer,
  offers: Offer[],
  depth: number,
  visited: Set<string>,
  isRoot: boolean,
): LayoutNode {
  if (visited.has(offer.id)) {
    return {
      id: offer.id + "-loop-" + depth,
      offer,
      x: 0,
      y: depth * (NODE_H + V_GAP),
      isLoop: true,
      children: [],
    };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(offer.id);

  const node: LayoutNode = {
    id: offer.id,
    offer,
    x: 0,
    y: depth * (NODE_H + V_GAP),
    isRoot,
    children: [],
  };

  const acceptOffer = offer.accept_next_offer_id
    ? offers.find((o) => o.id === offer.accept_next_offer_id)
    : null;
  const rejectOffer = offer.reject_next_offer_id
    ? offers.find((o) => o.id === offer.reject_next_offer_id)
    : null;

  if (acceptOffer) {
    node.children.push({ node: buildTree(acceptOffer, offers, depth + 1, nextVisited, false), type: "accept" });
  }
  if (rejectOffer) {
    node.children.push({ node: buildTree(rejectOffer, offers, depth + 1, nextVisited, false), type: "reject" });
  }

  return node;
}

function getSubtreeWidth(node: LayoutNode): number {
  if (node.children.length === 0 || node.isLoop) return NODE_W + H_GAP;
  const w = node.children.reduce((s, c) => s + getSubtreeWidth(c.node), 0);
  return Math.max(NODE_W + H_GAP, w);
}

function assignPositions(node: LayoutNode, left: number): void {
  const total = getSubtreeWidth(node);
  node.x = left + total / 2 - NODE_W / 2;

  if (node.children.length === 0 || node.isLoop) return;
  let childLeft = left;
  for (const child of node.children) {
    const cw = getSubtreeWidth(child.node);
    assignPositions(child.node, childLeft);
    childLeft += cw;
  }
}

function collectAll(node: LayoutNode, nodes: LayoutNode[], edges: Edge[]): void {
  nodes.push(node);
  if (node.isLoop) return;
  for (const child of node.children) {
    edges.push({
      fromX: node.x + NODE_W / 2,
      fromY: node.y + NODE_H,
      toX: child.node.x + NODE_W / 2,
      toY: child.node.y,
      type: child.type,
      toLoop: child.node.isLoop,
      fromId: node.id,
      toId: child.node.id,
    });
    collectAll(child.node, nodes, edges);
  }

  // Add "end" pseudo-edges for leaf accept/reject that are null
  const hasAcceptChild = node.children.some((c) => c.type === "accept");
  const hasRejectChild = node.children.some((c) => c.type === "reject");

  if (!node.isLoop) {
    if (!hasAcceptChild && node.offer.accept_next_offer_id === null && (hasRejectChild || node.children.length === 0)) {
      // No accept path defined — could show end node
    }
    if (!hasRejectChild && node.offer.reject_next_offer_id === null && (hasAcceptChild || node.children.length === 0)) {
      // No reject path defined — could show end node
    }
  }
}

function getBounds(nodes: LayoutNode[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_W);
    maxY = Math.max(maxY, n.y + NODE_H);
  }
  return { minX, minY, maxX, maxY };
}

/* ------------------------------------------------------------------ */
/*  Sidebar detail panel                                               */
/* ------------------------------------------------------------------ */
function SidebarPanel({
  offer,
  offers,
  onClose,
}: {
  offer: Offer;
  offers: Offer[];
  onClose: () => void;
}) {
  const acceptName = offer.accept_next_offer_id
    ? offers.find((o) => o.id === offer.accept_next_offer_id)?.name ?? "—"
    : null;
  const rejectName = offer.reject_next_offer_id
    ? offers.find((o) => o.id === offer.reject_next_offer_id)?.name ?? "—"
    : null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-card border-l border-border z-20 flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Detalhes</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Name */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Nome da oferta</p>
          <p className="text-sm font-semibold text-foreground">{offer.name}</p>
        </div>

        {/* Product */}
        <div className="bg-secondary rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Produto</p>
          </div>
          <p className="text-[13px] font-medium text-foreground">{offer.products?.name ?? "—"}</p>
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-bold text-foreground tabular-nums">{formatCents(offer.products?.price ?? 0)}</span>
          </div>
        </div>

        {/* Mode */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Modo</p>
          <div className="flex items-center gap-2">
            {offer.page_url ? (
              <>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-foreground">Página Externa</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Inline (página de sucesso)</span>
            )}
          </div>
          {offer.page_url && (
            <p className="text-[10px] text-muted-foreground mt-1 break-all">{offer.page_url}</p>
          )}
        </div>

        {/* Flow connections */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Fluxo</p>

          {/* Accept path */}
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))] mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Se aceitar</p>
              <p className="text-xs font-medium text-foreground">
                {acceptName ? (
                  <span className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" /> {acceptName}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">Fim do funil</span>
                )}
              </p>
            </div>
          </div>

          {/* Reject path */}
          <div className="flex items-start gap-2">
            <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">Se recusar</p>
              <p className="text-xs font-medium text-foreground">
                {rejectName ? (
                  <span className="flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" /> {rejectName}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">Fim do funil</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Canvas component                                                   */
/* ------------------------------------------------------------------ */
function FunnelCanvas({ root, offers }: { root: Offer; offers: Offer[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Build layout
  const { allNodes, edges, canvasW, canvasH, offsetX, offsetY } = useMemo(() => {
    const tree = buildTree(root, offers, 0, new Set(), true);
    assignPositions(tree, 0);
    const nodes: LayoutNode[] = [];
    const edg: Edge[] = [];
    collectAll(tree, nodes, edg);
    const bounds = getBounds(nodes);
    const PADDING = 80;
    const cW = bounds.maxX - bounds.minX + PADDING * 2;
    const cH = bounds.maxY - bounds.minY + PADDING * 2;
    return {
      allNodes: nodes,
      edges: edg,
      canvasW: cW,
      canvasH: cH,
      offsetX: -bounds.minX + PADDING,
      offsetY: -bounds.minY + PADDING,
    };
  }, [root, offers]);

  const selectedOffer = selectedId ? offers.find((o) => o.id === selectedId) ?? null : null;

  // Fit on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const fitScale = Math.min(cw / canvasW, ch / canvasH, 1) * 0.9;
    setTransform({
      x: (cw - canvasW * fitScale) / 2,
      y: (ch - canvasH * fitScale) / 2,
      scale: fitScale,
    });
  }, [canvasW, canvasH]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => {
      const newScale = Math.min(Math.max(t.scale * delta, 0.15), 3);
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      return { scale: newScale, x: mx - (mx - t.x) * (newScale / t.scale), y: my - (my - t.y) * (newScale / t.scale) };
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [transform.x, transform.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setTransform((t) => ({
      ...t,
      x: dragStart.current.tx + (e.clientX - dragStart.current.x),
      y: dragStart.current.ty + (e.clientY - dragStart.current.y),
    }));
  }, [dragging]);

  const handlePointerUp = useCallback(() => setDragging(false), []);

  const zoom = (factor: number) => {
    setTransform((t) => {
      const cw = containerRef.current!.clientWidth;
      const ch = containerRef.current!.clientHeight;
      const newScale = Math.min(Math.max(t.scale * factor, 0.15), 3);
      return { scale: newScale, x: cw / 2 - (cw / 2 - t.x) * (newScale / t.scale), y: ch / 2 - (ch / 2 - t.y) * (newScale / t.scale) };
    });
  };

  const fitToView = () => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const fitScale = Math.min(cw / canvasW, ch / canvasH, 1) * 0.9;
    setTransform({ x: (cw - canvasW * fitScale) / 2, y: (ch - canvasH * fitScale) / 2, scale: fitScale });
  };

  // Dot grid background
  const gridSize = 20;

  return (
    <div className="relative rounded-xl border border-border overflow-hidden" style={{ height: "600px" }}>
      {/* Dot grid background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)`,
        backgroundSize: `${gridSize}px ${gridSize}px`,
        opacity: 0.5,
      }} />

      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-card/90 backdrop-blur-md border border-border rounded-lg p-1">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => zoom(1.3)} title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => zoom(0.7)} title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={fitToView} title="Fit to view">
          <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
      </div>

      {/* Scale indicator */}
      <div className="absolute top-3 right-3 z-10 text-[10px] text-muted-foreground bg-card/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border tabular-nums">
        {Math.round(transform.scale * 100)}%
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-card/60 backdrop-blur-sm px-2.5 py-1.5 rounded-md border border-border">
        <Move className="h-3 w-3" /> Arraste para mover · Scroll para zoom · Clique para detalhes
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-3 text-[10px] text-muted-foreground bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-md border border-border">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--info))]" /> Início</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" /> Upsell</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--warning))]" /> Downsell</span>
      </div>

      {/* Sidebar panel */}
      {selectedOffer && (
        <SidebarPanel
          offer={selectedOffer}
          offers={offers}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="w-full h-full select-none"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
            position: "relative",
            width: canvasW,
            height: canvasH,
            transition: dragging ? "none" : "transform 0.08s ease-out",
          }}
        >
          {/* SVG Edges */}
          <svg
            width={canvasW}
            height={canvasH}
            className="absolute inset-0 pointer-events-none"
            style={{ overflow: "visible" }}
          >
            <defs>
              <marker id="arrow-accept" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 0 L 12 6 L 0 12 z" fill="hsl(var(--success))" opacity="0.8" />
              </marker>
              <marker id="arrow-reject" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="8" markerHeight="8" orient="auto">
                <path d="M 0 0 L 12 6 L 0 12 z" fill="hsl(var(--destructive))" opacity="0.8" />
              </marker>
              {/* Glow filters */}
              <filter id="glow-accept" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-reject" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {edges.map((edge, i) => {
              const fx = edge.fromX + offsetX;
              const fy = edge.fromY + offsetY;
              const tx = edge.toX + offsetX;
              const ty = edge.toY + offsetY;
              const controlOffset = (ty - fy) * 0.45;
              const isAccept = edge.type === "accept";
              const color = isAccept ? "hsl(var(--success))" : "hsl(var(--destructive))";
              const edgeKey = `${edge.fromId}-${edge.toId}`;
              const isHovered = hoveredEdge === edgeKey;
              const isNodeSelected = selectedId === edge.fromId || selectedId === edge.toId;
              const opacity = isHovered || isNodeSelected ? 1 : 0.55;
              const strokeW = isHovered || isNodeSelected ? 2.5 : 1.8;

              return (
                <g
                  key={i}
                  style={{ transition: "opacity 0.2s ease" }}
                  onMouseEnter={() => setHoveredEdge(edgeKey)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  className="pointer-events-auto"
                >
                  {/* Invisible fat hitbox for hover */}
                  <path
                    d={`M ${fx} ${fy} C ${fx} ${fy + controlOffset}, ${tx} ${ty - controlOffset}, ${tx} ${ty}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    className="cursor-pointer"
                  />
                  {/* Glow layer */}
                  {(isHovered || isNodeSelected) && (
                    <path
                      d={`M ${fx} ${fy} C ${fx} ${fy + controlOffset}, ${tx} ${ty - controlOffset}, ${tx} ${ty}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={6}
                      opacity={0.15}
                      filter={isAccept ? "url(#glow-accept)" : "url(#glow-reject)"}
                    />
                  )}
                  {/* Main path */}
                  <path
                    d={`M ${fx} ${fy} C ${fx} ${fy + controlOffset}, ${tx} ${ty - controlOffset}, ${tx} ${ty}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeW}
                    strokeDasharray={edge.toLoop ? "8 5" : "none"}
                    markerEnd={isAccept ? "url(#arrow-accept)" : "url(#arrow-reject)"}
                    opacity={opacity}
                    style={{
                      transition: "stroke-width 0.2s ease, opacity 0.2s ease",
                    }}
                  />
                  {/* Animated dot flowing down the path */}
                  {mounted && (isHovered || isNodeSelected) && (
                    <circle r="3" fill={color} opacity="0.9">
                      <animateMotion
                        dur="2s"
                        repeatCount="indefinite"
                        path={`M ${fx} ${fy} C ${fx} ${fy + controlOffset}, ${tx} ${ty - controlOffset}, ${tx} ${ty}`}
                      />
                    </circle>
                  )}
                  {/* Edge label */}
                  <g style={{ opacity: opacity + 0.15 }}>
                    <rect
                      x={(fx + tx) / 2 - 24}
                      y={(fy + ty) / 2 - 8}
                      width={48}
                      height={16}
                      rx={8}
                      fill="hsl(var(--card))"
                      stroke={color}
                      strokeWidth={1}
                      opacity={0.9}
                    />
                    <text
                      x={(fx + tx) / 2}
                      y={(fy + ty) / 2 + 4}
                      fill={color}
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="middle"
                      style={{ fontFamily: "inherit" }}
                    >
                      {isAccept ? "Aceitar" : "Recusar"}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {allNodes.map((node, idx) => {
            const nType = getNodeType(node.offer, !!node.isRoot);
            const colors = nodeColors[nType];
            const isSelected = selectedId === node.id;
            const delayMs = idx * 60;

            if (node.isLoop) {
              return (
                <div
                  key={node.id}
                  className="absolute rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 flex items-center justify-center text-center cursor-pointer hover:border-muted-foreground/50 transition-all duration-200"
                  style={{
                    left: node.x + offsetX,
                    top: node.y + offsetY,
                    width: NODE_W,
                    height: 48,
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "scale(1)" : "scale(0.9)",
                    transition: `opacity 0.3s ease ${delayMs}ms, transform 0.3s ease ${delayMs}ms, border-color 0.2s ease`,
                  }}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(node.offer.id); }}
                >
                  <span className="text-[11px] text-muted-foreground">↻ {node.offer.name}</span>
                </div>
              );
            }

            return (
              <div
                key={node.id}
                className={`absolute rounded-xl border-2 ${colors.border} ${colors.bg} cursor-pointer transition-all duration-200 ${isSelected ? colors.glow + " scale-[1.03]" : "hover:scale-[1.02]"} hover:${colors.glow}`}
                style={{
                  left: node.x + offsetX,
                  top: node.y + offsetY,
                  width: NODE_W,
                  height: NODE_H,
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? (isSelected ? "scale(1.03)" : "scale(1)") : "scale(0.85) translateY(10px)",
                  transition: `opacity 0.35s ease ${delayMs}ms, transform 0.35s cubic-bezier(0.34,1.56,0.64,1) ${delayMs}ms, box-shadow 0.2s ease`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(isSelected ? null : node.id);
                }}
              >
                {/* Type label chip */}
                <div className="absolute -top-2.5 left-3">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-card border border-border ${colors.labelColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                    {colors.label}
                  </span>
                </div>

                {/* Content */}
                <div className="flex flex-col items-center justify-center h-full px-4 pt-2">
                  <span className="text-[13px] font-semibold text-foreground leading-tight truncate w-full text-center">
                    {node.offer.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center mt-1">
                    {node.offer.products?.name}
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 font-bold tabular-nums">
                      {formatCents(node.offer.products?.price ?? 0)}
                    </Badge>
                    {node.offer.page_url && (
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <ExternalLink className="h-2.5 w-2.5" /> ext
                      </span>
                    )}
                  </div>
                </div>

                {/* Selected ring pulse */}
                {isSelected && (
                  <div
                    className={`absolute inset-0 rounded-xl border-2 ${colors.border} animate-pulse pointer-events-none`}
                    style={{ opacity: 0.4 }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */
export const OfferFunnelTree = React.forwardRef<HTMLDivElement, OfferFunnelTreeProps>(
  ({ offers }, ref) => {
    const referencedIds = new Set<string>();
    offers.forEach((o) => {
      if (o.accept_next_offer_id) referencedIds.add(o.accept_next_offer_id);
      if (o.reject_next_offer_id) referencedIds.add(o.reject_next_offer_id);
    });
    const roots = offers.filter((o) => !referencedIds.has(o.id));

    if (offers.length === 0)
      return (
        <div ref={ref} className="rounded-xl border border-border bg-secondary/50 py-16 text-center text-muted-foreground text-[13px]">
          Crie ofertas para visualizar o funil
        </div>
      );

    if (roots.length === 0)
      return (
        <div ref={ref} className="rounded-xl border border-border bg-secondary/50 py-16 text-center text-muted-foreground text-[13px]">
          Todas as ofertas estão em loops.
        </div>
      );

    return (
      <div ref={ref} className="space-y-6">
        {roots.map((root) => (
          <div key={root.id} className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--info))] animate-pulse" />
              <h3 className="text-sm font-semibold text-foreground">
                Funil: {root.name}
              </h3>
              <span className="text-[10px] text-muted-foreground">
                ({offers.length} oferta{offers.length !== 1 ? "s" : ""})
              </span>
            </div>
            <FunnelCanvas root={root} offers={offers} />
          </div>
        ))}
      </div>
    );
  }
);
OfferFunnelTree.displayName = "OfferFunnelTree";
