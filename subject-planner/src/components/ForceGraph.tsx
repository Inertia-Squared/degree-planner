// components/ForceGraph.js
import {GraphCanvas, GraphCanvasRef, GraphEdge, LayoutTypes} from 'reagraph';
import { useEffect, useRef } from 'react';
import { ExtendedNode } from '@/utils/types';

interface ForceGraphProps {
    nodes: ExtendedNode<any>[],
    edges: GraphEdge[],
    doubleClickNodeAction: (id: string) => void,
    collapsedNodeIds?: string[],
    clickAction: (id: string, isNode?: boolean) => void,
    clickCanvas: () => void,
    layoutMode: LayoutTypes,
    clusterBy?: string,
    className?: string,
}

const ForceGraph = ({nodes, edges, className, doubleClickNodeAction, clusterBy, clickAction, clickCanvas, layoutMode, collapsedNodeIds}: ForceGraphProps) => {
    const classN = className ?? `w-[300px] h-screen relative`;
    const graphRef = useRef<GraphCanvasRef | null >(null);
    useEffect(() => {
        if (nodes.length > 0) {
            const timer = setTimeout(() => {
                graphRef.current?.fitNodesInView();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [nodes]);
    return (
        <div className={classN}>
            {clusterBy ? <GraphCanvas ref={graphRef} cameraMode={'pan'} collapsedNodeIds={collapsedNodeIds ?? []} labelType={'nodes'} layoutType={layoutMode} clusterAttribute={(layoutMode === 'forceDirected2d') ? clusterBy : undefined} draggable={true} onCanvasClick={clickCanvas} onNodeClick={(node)=>clickAction(node.id)} onEdgeClick={(edge)=>clickAction(edge.id, false)} onNodeDoubleClick={(node) => doubleClickNodeAction(node.id)} nodes={nodes} edges={edges}/>
            : <GraphCanvas ref={graphRef} cameraMode={'pan'} collapsedNodeIds={collapsedNodeIds ?? []} labelType={'nodes'} layoutType={layoutMode} draggable={true} onCanvasClick={clickCanvas} onNodeClick={(node)=>clickAction(node.id)} onEdgeClick={(edge)=>clickAction(edge.id, false)} onNodeDoubleClick={(node) => doubleClickNodeAction(node.id)} nodes={nodes} edges={edges}/>
                        }
        </div>
    );
};

export default ForceGraph;