// components/ForceGraph.js
import {GraphCanvas, GraphEdge, LayoutTypes} from 'reagraph';
import {ExtendedNode} from "@/app/page";

interface ForceGraphProps {
    nodes: ExtendedNode<any>[],
    edges: GraphEdge[],
    doubleClickNodeAction: (id: string) => void,
    collapsedNodeIds: string[],
    clickAction: (id: string, isNode?: boolean) => void,
    clickCanvas: () => void,
    layoutMode: LayoutTypes,
    clusterBy?: string,
    className?: string,
}

const ForceGraph = ({nodes, edges, className, doubleClickNodeAction, clusterBy, clickAction, clickCanvas, layoutMode, collapsedNodeIds}: ForceGraphProps) => {
    const classN = className ?? `w-[300px] h-full relative`;
    return (
        <div className={classN}>
            <GraphCanvas collapsedNodeIds={collapsedNodeIds} labelType={'nodes'} layoutType={layoutMode} clusterAttribute={(layoutMode === 'forceDirected2d') ? clusterBy : undefined} draggable={true} onCanvasClick={clickCanvas} onNodeClick={(node)=>clickAction(node.id)} onEdgeClick={(edge)=>clickAction(edge.id, false)} onNodeDoubleClick={(node) => doubleClickNodeAction(node.id)} nodes={nodes} edges={edges}/>
        </div>
    );
};

export default ForceGraph;