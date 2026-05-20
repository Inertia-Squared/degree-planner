import { GraphCanvas, GraphCanvasRef, LayoutTypes } from 'reagraph';
import { useEffect, useRef } from 'react';
import { useGraphDataStore, useGraphRenderStore } from '@/app/store/graphStore';
import {onNodeDoubleClicked, selectElement} from "@/app/store/graphActions";

interface ForceGraphProps {
    collapsedNodeIds?: string[];
    clickCanvas: () => void;
    layoutMode: LayoutTypes;
    className?: string;
}

// Module-level variable to expose Graph ref functionally without violating React Hook rules
let internalGraphRef: GraphCanvasRef | null = null;

const ForceGraph = ({ className, clickCanvas, layoutMode, collapsedNodeIds }: ForceGraphProps) => {
    const classN = className ?? `w-[300px] h-screen relative`;

    const dataNodes = useGraphDataStore((state) => state.nodes);
    const dataEdges = useGraphDataStore((state) => state.edges);

    const renderNodes = useGraphRenderStore((state) => state.displayedNodes);
    const renderEdges = useGraphRenderStore((state) => state.displayedEdges);

    // If GraphRenderStore is empty (i.e. filters haven't run yet), show raw DataStore temporarily
    const nodes = renderNodes.length > 0 ? renderNodes : dataNodes;
    const edges = renderEdges.length > 0 ? renderEdges : dataEdges;

    const clusterBy = useGraphRenderStore((state) => state.clusterBy);

    const graphRef = useRef<GraphCanvasRef | null>(null);

    useEffect(() => {
        internalGraphRef = graphRef.current;
    }, [nodes, edges, clusterBy, collapsedNodeIds, layoutMode]);

    return (
            <div className={classN}>
                {clusterBy ? (
                        <GraphCanvas
                                ref={graphRef}
                                cameraMode={'pan'}
                                collapsedNodeIds={collapsedNodeIds ?? []}
                                labelType={'nodes'}
                                layoutType={layoutMode}
                                clusterAttribute={(layoutMode === 'forceDirected2d' && clusterBy) ? clusterBy : undefined}
                                draggable={true}
                                onCanvasClick={clickCanvas}
                                onNodeClick={(node) => selectElement(node.id, true)}
                                onEdgeClick={(edge) => selectElement(edge.id, false)}
                                onNodeDoubleClick={(node) => onNodeDoubleClicked(node.id)}
                                nodes={nodes}
                                edges={edges}
                        />
                ) : (
                        <GraphCanvas
                                ref={graphRef}
                                cameraMode={'pan'}
                                collapsedNodeIds={collapsedNodeIds ?? []}
                                labelType={'nodes'}
                                layoutType={layoutMode}
                                draggable={true}
                                onCanvasClick={clickCanvas}
                                onNodeClick={(node) => selectElement(node.id, true)}
                                onEdgeClick={(edge) => selectElement(edge.id, false)}
                                onNodeDoubleClick={(node) => onNodeDoubleClicked(node.id)}
                                nodes={nodes}
                                edges={edges}
                        />
                )}
            </div>
    );
};

export function fitGraphCamera() {
    if (internalGraphRef) internalGraphRef.fitNodesInView();
}

export default ForceGraph;