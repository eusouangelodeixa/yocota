import * as React from "react";
import { useRef, useState, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/formatters";
import { ZoomIn, ZoomOut, Maximize2, Move } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Offer {
  id: string;
  name: string;
  product_id: string;
  accept_next_offer_id: string | null;
  reject_next_offer_id: string | null;
  products?: { name: string; price: number } | null;
}

interface OfferFunnelTreeProps {
  offers: Offer[];
}

// Layout constants
const NODE_W = 200;
const NODE_H = 80;
const H_GAP = 60;
const V_GAP = 100;

interface LayoutNode {
  id: string;
  offer: Offer;
  x: number;
  y: number;
  isLoop?: boolean;
  children: { node: LayoutNode; type: "accept" | "reject" }[];
}

interface Edge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  type: "accept" | "reject";
  toLoop?: boolean;
}

function layoutTree(
  offer: Offer,
  offers: Offer[],
  depth: number,
  visited: Set<string>,
  positionMap: Map<string, LayoutNode>
): LayoutNode {
  if (visited.has(offer.id)) {
    const loopNode: LayoutNode = {
      id: offer.id + "-loop-" + depth,
      offer,
      x: 0,
      y: depth * (NODE_H + V_GAP),
      isLoop: true,
      children: [],
    };
    return loopNode;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(offer.id);

  const node: LayoutNode = {
    id: offer.id,
    offer,
    x: 0,
    y: depth * (NODE_H + V_GAP),
    children: [],
  };

  const acceptOffer = offer.accept_next_offer_id
    ? offers.find((o) => o.id === offer.accept_next_offer_id)
    : null;
  const rejectOffer = offer.reject_next_offer_id
    ? offers.find((o) => o.id === offer.reject_next_offer_id)
    : null;

  if (acceptOffer) {
    const child = layoutTree(acceptOffer, offers, depth + 1, nextVisited, positionMap);
    node.children.push({ node: child, type: "accept" });
  }
  if (rejectOffer) {
    const child = layoutTree(rejectOffer, offers, depth + 1, nextVisited, positionMap);
    node.children.push({ node: child, type: "reject" });
  }

  return node;
}

function getSubtreeWidth(node: LayoutNode): number {
  if (node.children.length === 0 || node.isLoop) return NODE_W;
  const childrenWidth = node.children.reduce(
    (sum, c) => sum + getSubtreeWidth(c.node),
    0
  );
  return Math.max(NODE_W, childrenWidth + (node.children.length - 1) * H_GAP);
}

function assignPositions(node: LayoutNode, left: number): void {
  const totalWidth = getSubtreeWidth(node);
  node.x = left + totalWidth / 2 - NODE_W / 2;

  if (node.children.length === 0 || node.isLoop) return;

  let childLeft = left;
  for (const child of node.children) {
    const childWidth = getSubtreeWidth(child.node);
    assignPositions(child.node, childLeft);
    childLeft += childWidth + H_GAP;
  }
}

function collectEdges(node: LayoutNode, edges: Edge[]): void {
  if (node.isLoop) return;
  for (const child of node.children) {
    edges.push({
      fromX: node.x + NODE_W / 2,
      fromY: node.y + NODE_H,
      toX: child.node.x + NODE_W / 2,
      toY: child.node.y,
      type: child.type,
      toLoop: child.node.isLoop,
    });
    collectEdges(child.node, edges);
  }
}

function collectNodes(node: LayoutNode, nodes: LayoutNode[]): void {
  nodes.push(node);
  for (const child of node.children) {
    collectNodes(child.node, nodes);
  }
}

function getBounds(nodes: LayoutNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + NODE_W);
    maxY = Math.max(maxY, n.y + NODE_H);
  }
  return { minX, minY, maxX, maxY };
}

function FunnelCanvas({ root, offers }: { root: Offer; offers: Offer[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // Build layout
  const tree = layoutTree(root, offers, 0, new Set(), new Map());
  assignPositions(tree, 0);

  const allNodes: LayoutNode[] = [];
  collectNodes(tree, allNodes);

  const edges: Edge[] = [];
  collectEdges(tree, edges);

  const bounds = getBounds(allNodes);
  const PADDING = 60;
  const canvasW = bounds.maxX - bounds.minX + PADDING * 2;
  const canvasH = bounds.maxY - bounds.minY + PADDING * 2;
  const offsetX = -bounds.minX + PADDING;
  const offsetY = -bounds.minY + PADDING;

  // Center on mount
  useEffect(() => {
    if (containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const fitScale = Math.min(cw / canvasW, ch / canvasH, 1);
      setTransform({
        x: (cw - canvasW * fitScale) / 2,
        y: (ch - canvasH * fitScale) / 2,
        scale: fitScale,
      });
    }
  }, [canvasW, canvasH]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => {
      const newScale = Math.min(Math.max(t.scale * delta, 0.2), 3);
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      return {
        scale: newScale,
        x: mx - (mx - t.x) * (newScale / t.scale),
        y: my - (my - t.y) * (newScale / t.scale),
      };
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
      const newScale = Math.min(Math.max(t.scale * factor, 0.2), 3);
      return {
        scale: newScale,
        x: cw / 2 - (cw / 2 - t.x) * (newScale / t.scale),
        y: ch / 2 - (ch / 2 - t.y) * (newScale / t.scale),
      };
    });
  };

  const fitToView = () => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const fitScale = Math.min(cw / canvasW, ch / canvasH, 1);
    setTransform({
      x: (cw - canvasW * fitScale) / 2,
      y: (ch - canvasH * fitScale) / 2,
      scale: fitScale,
    });
  };

  return (
    <div className="relative rounded-[10px] border border-border bg-[hsl(var(--secondary))] overflow-hidden" style={{ height: "500px" }}>
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm border-border" onClick={() => zoom(1.25)} title="Zoom in">
          <ZoomIn className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm border-border" onClick={() => zoom(0.8)} title="Zoom out">
          <ZoomOut className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
        <Button variant="outline" size="icon" className="h-7 w-7 bg-background/80 backdrop-blur-sm border-border" onClick={fitToView} title="Fit to view">
          <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
        </Button>
      </div>

      {/* Hint */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-background/60 backdrop-blur-sm px-2 py-1 rounded-md">
        <Move className="h-3 w-3" /> Arraste para mover · Scroll para zoom
      </div>

      {/* Canvas */}
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
              <marker id="arrow-accept" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
              </marker>
              <marker id="arrow-reject" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--destructive))" />
              </marker>
            </defs>
            {edges.map((edge, i) => {
              const fx = edge.fromX + offsetX;
              const fy = edge.fromY + offsetY;
              const tx = edge.toX + offsetX;
              const ty = edge.toY + offsetY;
              const midY = fy + (ty - fy) * 0.5;
              const color = edge.type === "accept" ? "hsl(var(--primary))" : "hsl(var(--destructive))";
              const markerId = edge.type === "accept" ? "url(#arrow-accept)" : "url(#arrow-reject)";

              return (
                <g key={i}>
                  <path
                    d={`M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray={edge.toLoop ? "6 4" : "none"}
                    markerEnd={markerId}
                    opacity={0.7}
                  />
                  {/* Label on edge */}
                  <text
                    x={(fx + tx) / 2 + (edge.type === "accept" ? -20 : 20)}
                    y={midY - 6}
                    fill={color}
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="middle"
                    opacity={0.9}
                  >
                    {edge.type === "accept" ? "Aceitar" : "Recusar"}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {allNodes.map((node) => (
            <div
              key={node.id}
              className={`absolute rounded-lg border shadow-sm px-3 py-2.5 flex flex-col items-center justify-center text-center transition-shadow ${
                node.isLoop
                  ? "border-dashed border-muted-foreground/40 bg-muted/50"
                  : "border-border bg-card hover:shadow-md"
              }`}
              style={{
                left: node.x + offsetX - 0,
                top: node.y + offsetY,
                width: NODE_W,
                height: NODE_H,
              }}
            >
              {node.isLoop ? (
                <span className="text-[11px] text-muted-foreground">
                  ↻ {node.offer.name}
                </span>
              ) : (
                <>
                  <span className="text-[12px] font-semibold text-foreground leading-tight truncate w-full">
                    {node.offer.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate w-full mt-0.5">
                    {node.offer.products?.name}
                  </span>
                  <Badge variant="secondary" className="mt-1 text-[9px] px-1.5 py-0">
                    {formatCents(node.offer.products?.price ?? 0)}
                  </Badge>
                </>
              )}
            </div>
          ))}

          {/* End nodes for leaves with no children */}
          {allNodes
            .filter((n) => !n.isLoop && n.children.length === 0 && (n.offer.accept_next_offer_id === null && n.offer.reject_next_offer_id === null))
            .map((n) => null)}
        </div>
      </div>
    </div>
  );
}

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
        <div
          ref={ref}
          className="card-surface rounded-[10px] py-12 text-center text-muted-foreground text-[13px]"
        >
          Crie ofertas para visualizar o funil
        </div>
      );

    if (roots.length === 0)
      return (
        <div
          ref={ref}
          className="card-surface rounded-[10px] py-12 text-center text-muted-foreground text-[13px]"
        >
          Todas as ofertas estão em loops.
        </div>
      );

    return (
      <div ref={ref} className="space-y-6">
        {roots.map((root) => (
          <div key={root.id} className="space-y-2">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Funil: {root.name}
            </h3>
            <FunnelCanvas root={root} offers={offers} />
          </div>
        ))}
      </div>
    );
  }
);
OfferFunnelTree.displayName = "OfferFunnelTree";
