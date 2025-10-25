import {
    ExtendedNode,
    PrerequisiteExtension,
    SubjectExtension
} from "@/app/page";
import {getCourseCode} from "@/lib/graph/graphUtil";
import {GraphEdge} from "reagraph";

export function filterSubjectsNotInSequence(node: ExtendedNode<SubjectExtension>, selectedProgram: string, selectedSequence: string){
    let isInSelectedSequence = false;
    if (node.data.subjectSequences.length < 1) return true;
    if (!node.data.subjectSequences.includes(selectedProgram)) return true;
    node.data.subjectSequences.forEach((sequence: string)=>{
        if (sequence.toLowerCase().includes(selectedSequence.toLowerCase()) || sequence.length < 1) isInSelectedSequence = true;
    });
    return isInSelectedSequence;
}

export function filterPrerequisitesNotInCourse(node: ExtendedNode<PrerequisiteExtension>, selectedProgramName: string){
    const programCode = getCourseCode(selectedProgramName);
    if (programCode === 'nomatch') {
        return true; // we don't have enough info to determine
    }
    const nodeCourse = node.data.course;
    return (nodeCourse === programCode || nodeCourse === 'any' || nodeCourse === 'SPECIAL');
}

export function filterDisconnectedEdges(edge: GraphEdge, visibleNodes: ExtendedNode<any>[]){
    let hasSource = false;
    let hasTarget = false;
    visibleNodes.forEach(node=>{
        if (edge.source === node.id) hasSource = true;
        if (edge.target === node.id) hasTarget = true;
    });
    return hasSource && hasTarget;
}

export function filterLeafPrerequisites(node: ExtendedNode<PrerequisiteExtension>, edges: GraphEdge[]){
    let hasTarget = false;
    edges.forEach((edge)=>{
        if (edge.source === node.id) hasTarget = true;
    });
    return hasTarget;
}