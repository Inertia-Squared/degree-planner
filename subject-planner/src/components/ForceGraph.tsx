// components/ForceGraph.js
import {GraphCanvas, GraphEdge} from 'reagraph';
import {ExtendedNode} from "@/app/page";

interface ForceGraphProps {
    nodes: ExtendedNode[],
    edges: GraphEdge[],
    doubleClickNodeAction: (id: string) => void,
    clickAction: (id: string, isNode?: boolean) => void,
    clickCanvas: () => void,
    clusterBy?: string,
    className?: string,
}

const ForceGraph = ({nodes, edges, className, doubleClickNodeAction, clusterBy, clickAction, clickCanvas}: ForceGraphProps) => {
    const classN = className ?? `w-[300px] h-full relative`;
    return (
        <div className={classN}>
            <GraphCanvas draggable={true} onCanvasClick={clickCanvas} onNodeClick={(node)=>clickAction(node.id)} onEdgeClick={(edge)=>clickAction(edge.id, false)} clusterAttribute={clusterBy} onNodeDoubleClick={(node) => doubleClickNodeAction(node.id)} nodes={nodes} edges={edges}/>
        </div>
    );
};

export default ForceGraph;