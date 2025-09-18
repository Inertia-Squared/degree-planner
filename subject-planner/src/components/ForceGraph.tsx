// components/ForceGraph.js
import {GraphCanvas, GraphEdge, GraphNode} from 'reagraph';

interface ForceGraphProps {
    nodes: GraphNode[],
    edges: GraphEdge[],
    doubleClickNodeAction: (id: string) => void
    className?: string,
}

const ForceGraph = ({nodes, edges, className, doubleClickNodeAction}: ForceGraphProps) => {
    const classN = className ?? `w-[300px] h-full relative`;
    return (
        <div className={classN}>
            <GraphCanvas  onNodeDoubleClick={(node) => doubleClickNodeAction(node.id)} nodes={nodes} edges={edges}/>
        </div>
    );
};

export default ForceGraph;