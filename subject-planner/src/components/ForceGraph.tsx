// components/ForceGraph.js
import {GraphCanvas, GraphCanvasRef, GraphEdge, LayoutTypes} from 'reagraph';
import {Dispatch, RefObject, SetStateAction, useEffect, useRef} from 'react';
import {ExtendedNode} from '@/utils/types';

interface ForceGraphProps {
    nodes: ExtendedNode<any>[],
    edges: GraphEdge[],
    doubleClickNodeAction: (id: string) => void,
    collapsedNodeIds?: string[],
    clickAction: (id: string, isNode?: boolean) => void,
    clickCanvas: () => void,
    setGraphRef: Dispatch<SetStateAction<RefObject<GraphCanvasRef | null> | undefined>>;
    layoutMode: LayoutTypes,
    clusterBy?: string,
    className?: string,
}

const ForceGraph = ({nodes, edges, className, doubleClickNodeAction, clusterBy, clickAction, clickCanvas, layoutMode, collapsedNodeIds, setGraphRef}: ForceGraphProps) => {
    const classN = className ?? `w-[300px] h-screen relative`;
    const graphRef = useRef<GraphCanvasRef | null >(null);
    useEffect(() => {
        if (graphRef.current) setGraphRef(graphRef);
    }, [nodes, edges, clusterBy, collapsedNodeIds, layoutMode]);
    return (
        <div className={classN}>
            {clusterBy ? <GraphCanvas ref={graphRef} cameraMode={'pan'} collapsedNodeIds={collapsedNodeIds ?? []} labelType={'nodes'} layoutType={layoutMode} clusterAttribute={(layoutMode === 'forceDirected2d') ? clusterBy : undefined} draggable={true} onCanvasClick={clickCanvas} onNodeClick={(node)=>clickAction(node.id)} onEdgeClick={(edge)=>clickAction(edge.id, false)} onNodeDoubleClick={(node) => doubleClickNodeAction(node.id)} nodes={nodes} edges={edges}/>
            : <GraphCanvas ref={graphRef} cameraMode={'pan'} collapsedNodeIds={collapsedNodeIds ?? []} labelType={'nodes'} layoutType={layoutMode} draggable={true} onCanvasClick={clickCanvas} onNodeClick={(node)=>clickAction(node.id)} onEdgeClick={(edge)=>clickAction(edge.id, false)} onNodeDoubleClick={(node) => doubleClickNodeAction(node.id)} nodes={nodes} edges={edges}/>
                        }
        </div>
    );
};

export default ForceGraph;