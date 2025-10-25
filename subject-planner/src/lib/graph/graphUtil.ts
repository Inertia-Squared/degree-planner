import {ExtendedNode, GenericNode} from "@/app/page";
import {LogicalPrerequisite} from "../../../../neo4j/upload-data-to-db";
import {NodeTypes} from "@/lib/siteUtil";

export function getCourseCode(course: string){
    return (course.match(/(\d{4})/) ?? ['nomatch', 'nomatch'])[1];
}

export function getParentsByType(node: ExtendedNode<any>, visibleNodes: ExtendedNode<any>[], adjacencyList: Map<string, string[]>, nodeMap: Map<string, ExtendedNode<GenericNode>>, parentType: NodeTypes | NodeTypes[]){
    const parentNodes = getParentNodes(node, adjacencyList, nodeMap);
    const parentPrerequisites = parentNodes.filter(p=>{
        if (parentType instanceof Array) {
            return parentType.includes(p?.data.type);
        } else {
            return p?.data.type === parentType
        }
    });
    return parentPrerequisites.filter(p => visibleNodes.includes(p));
}

export function getParentNodes(node: ExtendedNode<any>, adjacencyList: Map<string, string[]>, nodeMap: Map<string, ExtendedNode<GenericNode>>){
    const parentNodeIds = getParentNodeIds(node, adjacencyList);
    return parentNodeIds.map(p=>nodeMap.get(p)).filter(n=>n!==undefined);
}

export function getParentNodeIds(node: ExtendedNode<any>, adjacencyList: Map<string, string[]>){
    const parentNodes = [];
    for (const edgeId of adjacencyList.keys()){
        if (adjacencyList.get(edgeId)?.includes(node.id)) parentNodes.push(edgeId);
    }
    return parentNodes;
}

export function getAsLogicalPrerequisite(prerequisiteArray: string[]){
    return JSON.parse(JSON.stringify(prerequisiteArray)) as LogicalPrerequisite[]
}