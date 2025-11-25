import { NodeTypes } from "@/lib/siteUtil";
import { studyPeriods } from "./consts";
import { Choice, ExtendedNode, Generic, Major, Minor, Prerequisite, Program, Subject } from "./types";
import { GraphEdge } from "reagraph";

export function containsAll(object: any, components: string[]){
    let missingComponent = false;
    components.forEach((component)=>{
        if (!(component in object)) {
            missingComponent = true;
        }
    })
    return !missingComponent;
}

export function isExtendedNode(obj: any): obj is ExtendedNode<any> {
    return 'data' in obj;
}

export function isGenericNode(obj: any): obj is ExtendedNode<Generic>{
    return isExtendedNode(obj) && containsAll(obj.data, ['type']);
}

export function isSubjectNode(obj: any): obj is ExtendedNode<Subject>{
    return isGenericNode(obj) && containsAll(obj.data, ['code','prerequisites','subjectSequences', 'teachingPeriods']);
}

export function isProgramNode(obj: any): obj is ExtendedNode<Program>{
    return isGenericNode(obj) && containsAll(obj.data,['programName','programSequences']);
}


export function isPrerequisiteNode(obj: any): obj is ExtendedNode<Prerequisite>{
    return isGenericNode(obj) && containsAll(obj.data, ['course', 'subjects', 'forSubject']);
}


export function isMajorNode(obj: any): obj is ExtendedNode<Major>{
    return isGenericNode(obj) && containsAll(obj.data, ['majorName', 'majorType', 'majorLocations', 'majorLink']);
}


export function isMinorNode(obj: any): obj is ExtendedNode<Minor>{
    return isGenericNode(obj) && containsAll(obj.data, ['minorName', 'minorType', 'minorLocations', 'minorLink']);
}


export function isChoiceNode(obj: any): obj is ExtendedNode<Choice> {
    return isGenericNode(obj) && containsAll(obj.data, ['choiceName', 'parent']);
}

export function showNodeInfo(node: ExtendedNode<any>){
    console.log(`Info on Node | Is Generic: ${isGenericNode(node)}, 
    Is Subject: ${isSubjectNode(node)}, Is Program: ${isProgramNode(node)}, 
    Is Prerequisite: ${isPrerequisiteNode(node)}`)
}

export function asStudyPeriod(period: string){
    const value = studyPeriods.find(s=>period.toLowerCase().includes(s));
    if (!value){
        return 'unknown';
    }
    return value;
}

export function fromNodesById(id: string, nodes: ExtendedNode<any>[]){
        return nodes.find(n=>n.id===id);
    }

export function chooseNode(excludeId: string, filterType: NodeTypes, graph: { oldNodes: ExtendedNode<Generic>[], oldEdges: GraphEdge[]}){
        const nodesToRemove = new Set<string>();

        // Initial nodes to remove based on the filterType
        graph.oldNodes.forEach(n => {
            if (n.data.type === filterType && n.id !== excludeId) {
                nodesToRemove.add(n.id);
            }
        });

        // Recursively find and mark all children for removal
        let  newNodesAdded = true;
        while (newNodesAdded) {
            newNodesAdded = false;
            graph.oldEdges.forEach(edge => {
                if (nodesToRemove.has(edge.source) && ! nodesToRemove.has(edge.target)) {
                    nodesToRemove.add(edge.target);
                    newNodesAdded = true;
                }
            });
        }

        // Filter out the marked nodes and their  edges
        graph.oldNodes = graph.oldNodes.filter(n => !nodesToRemove.has(n.id));
        graph.oldEdges = graph.oldEdges.filter(e => !nodesToRemove.has(e.source) && !nodesToRemove.has(e.target));

        return graph;
    }