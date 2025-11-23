import { isChoiceNode } from "@/funcs";
import {LogicalPrerequisite} from "../../../../data-scraping/neo4j/upload-data-to-db";
import {getAsLogicalPrerequisite, getParentsByType} from "@/lib/graph/graphUtil";
import { ExtendedNode, Generic, Prerequisite, Subject } from "@/types";
import {GraphEdge} from "reagraph";

export function isEligibleForSubject(parentPrerequisites: ExtendedNode<Prerequisite>[], completedSubjects: ExtendedNode<Subject>[] | undefined){
    if (parentPrerequisites.length === 0) {
        return true;
    }
    let satisfiesAtLeastOnePrerequisite = false;
    for (const prerequisite of parentPrerequisites){
        if (prerequisiteIsFulfilled(prerequisite, completedSubjects)) satisfiesAtLeastOnePrerequisite = true;
    }
    return satisfiesAtLeastOnePrerequisite;
}

export function prerequisiteIsFulfilled(prerequisite: ExtendedNode<Prerequisite>, completedSubjects: ExtendedNode<Subject>[] | undefined){
    if (!completedSubjects || completedSubjects.length < 1) {
        return false;
    }
    const logicalPrerequisites: LogicalPrerequisite = getAsLogicalPrerequisite(prerequisite.data.subjects);
    let satisfied = true;
    for (const requirement of logicalPrerequisites.AND) {
        let containsAtLeastOne = false;
        completedSubjects.forEach(s=>{
            if (requirement.OR.includes(s.data.code)) {
                containsAtLeastOne = true;
            }
        });
        if (!containsAtLeastOne) satisfied = false;
    }
    return satisfied;
}

export function normaliseSubjectCode(code: string){
    if (code.match(/^\w{4} \d{4}$/)) return code;
    const match = code.match(/(\w{4})\s*(\d{4})/);
    if (!match) return code;
    return `${match[1]} ${match[2]}`.toUpperCase();
}

function parentEdgeHasLabel(node: ExtendedNode<any>, edges: GraphEdge[], labels: string[]){
            return edges.find(s=>labels.includes(s.label??'NEVER_MATCH') && s.target === node.id) !== undefined;
}

export enum RequiredType {
    NOT_REQUIRED,
    REQUIRED,
    PREREQUISITE_OF_REQUIRED,
}

export function isRequiredByProgramOrSpecialisation(node: ExtendedNode<Subject>, visibleNodes: ExtendedNode<any>[], adjacencyList: Map<string, string[]>, nodeMap: Map<string, ExtendedNode<Generic>>, edges: GraphEdge[]){
    const parentPrerequisites = getParentsByType<Prerequisite>(node, visibleNodes, adjacencyList, nodeMap, ['Prerequisites', 'SubjectChoice']);
    const parentProgramsOrByProxy = [];
    if (parentEdgeHasLabel(node, edges, ['REQUIRES_SUBJECT'])) {
        return RequiredType.REQUIRED;
    }
    for (const parentPrerequisite of parentPrerequisites){
        if (isChoiceNode(parentPrerequisite)) {
            return RequiredType.REQUIRED;
        }
        if (parentEdgeHasLabel(parentPrerequisite,edges, ['REQUIRES_SUBJECT', 'PROVIDES_SELECTION', 'REQUIRES_CHOICE'])) {
            if (parentPrerequisite.data.forSubject === node.data.code) return RequiredType.REQUIRED;
            parentProgramsOrByProxy.push(parentPrerequisite);
        }
    }
    return parentProgramsOrByProxy.length > 0 ? RequiredType.PREREQUISITE_OF_REQUIRED : RequiredType.NOT_REQUIRED;
}

