import {ExtendedNode, GenericNode, PrerequisiteExtension, SubjectExtension} from "@/app/page";
import {LogicalPrerequisite} from "../../../../neo4j/upload-data-to-db";
import {getAsLogicalPrerequisite, getParentsByType} from "@/lib/graph/graphUtil";
import {GraphEdge} from "reagraph";

export function isEligibleForSubject(parentPrerequisites: ExtendedNode<PrerequisiteExtension>[], completedSubjects: ExtendedNode<SubjectExtension>[] | undefined){
    if (parentPrerequisites.length === 0) {
        return true;
    }
    let satisfiesAtLeastOnePrerequisite = false;
    for (const prerequisite of parentPrerequisites){
        if (prerequisiteIsFulfilled(prerequisite, completedSubjects)) satisfiesAtLeastOnePrerequisite = true;
    }
    return satisfiesAtLeastOnePrerequisite;
}

export function prerequisiteIsFulfilled(prerequisite: ExtendedNode<PrerequisiteExtension>, completedSubjects: ExtendedNode<SubjectExtension>[] | undefined){
    if (prerequisite.data.forSubject === 'COMP 3019'){
        console.log(`Checking if prerequisite ${JSON.stringify(prerequisite)} is satisfied.`)
        if (!completedSubjects || completedSubjects.length < 1) {
            console.log('No completed subjects found. Cannot be satisfied.');
            return false;
        }
        const logicalPrerequisites: LogicalPrerequisite = getAsLogicalPrerequisite(prerequisite.data.subjects);
        console.log('Prerequisites parsed as:')
        console.log(logicalPrerequisites);
        let satisfied = true;
        for (const requirement of logicalPrerequisites.AND) {
            let containsAtLeastOne = false;
            console.log(`Checking if ${JSON.stringify(requirement.OR)} is satisfied.`)
            completedSubjects.forEach(s=>{
                if (requirement.OR.includes(s.data.code)) {
                    console.log(`${s.data.code} satisfies ${requirement.OR}`)
                    containsAtLeastOne = true;
                }
            });
            if (!containsAtLeastOne) satisfied = false;
        }
        return satisfied;
    } else {
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
}

function parentEdgeHasLabel(node: ExtendedNode<any>, edges: GraphEdge[], labels: string[]){
            return edges.find(s=>labels.includes(s.label??'NEVER_MATCH') && s.target === node.id) !== undefined;
}

export function isRequiredByProgramOrSpecialisation(node: ExtendedNode<SubjectExtension>, visibleNodes: ExtendedNode<any>[], adjacencyList: Map<string, string[]>, nodeMap: Map<string, ExtendedNode<GenericNode>>, edges: GraphEdge[]){
    const parentPrerequisites = getParentsByType(node, visibleNodes, adjacencyList, nodeMap, ['Prerequisites', 'SubjectChoice']);
    const parentProgramsOrByProxy = [];
    if (parentEdgeHasLabel(node, edges, ['REQUIRES_SUBJECT'])) parentProgramsOrByProxy.push(node);
    for (const parentPrerequisite of parentPrerequisites){
        if (parentEdgeHasLabel(parentPrerequisite,edges, ['REQUIRES_SUBJECT', 'PROVIDES_SELECTION', 'REQUIRES_CHOICE'])) parentProgramsOrByProxy.push(parentPrerequisite);
    }
    return parentProgramsOrByProxy.length > 0;
}

