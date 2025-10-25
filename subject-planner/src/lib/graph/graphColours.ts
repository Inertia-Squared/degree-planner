import {ExtendedNode, GenericNode, PrerequisiteExtension, SubjectExtension} from "@/app/page";
import {LogicalPrerequisite} from "../../../../neo4j/upload-data-to-db";
import {getAsLogicalPrerequisite, getParentsByType} from "@/lib/graph/graphUtil";

export function isEligibleForSubject(parentPrerequisites: ExtendedNode<PrerequisiteExtension>[], completedSubjects: ExtendedNode<SubjectExtension>[] | undefined){
    if (parentPrerequisites.length === 0) return true;
    let satisfiesAtLeastOnePrerequisite = false;
    for (const prerequisite of parentPrerequisites){
        if (prerequisiteIsFulfilled(prerequisite, completedSubjects)) satisfiesAtLeastOnePrerequisite = true;
    }
    return satisfiesAtLeastOnePrerequisite;
}

export function prerequisiteIsFulfilled(prerequisite: ExtendedNode<PrerequisiteExtension>, completedSubjects: ExtendedNode<SubjectExtension>[] | undefined){
    if (!completedSubjects) return false;
    const logicalPrerequisites: LogicalPrerequisite[] = getAsLogicalPrerequisite(prerequisite.data.subjects);
    for(const requirements of logicalPrerequisites) {
        let satisfied = true;
        for (const requirement of requirements.AND) {
            let containsAtLeastOne = false;
            completedSubjects.forEach(s=>{
                if (requirement.OR.includes(s.data.code)) containsAtLeastOne = true;
            })
            if (!containsAtLeastOne) satisfied = false;
        }
        if (satisfied) return true;
    }
    return false;
}

export function isRequiredByProgramOrSpecialisation(node: ExtendedNode<SubjectExtension>, visibleNodes: ExtendedNode<any>[], adjacencyList: Map<string, string[]>, nodeMap: Map<string, ExtendedNode<GenericNode>>){
    const parentPrerequisites = getParentsByType(node, visibleNodes, adjacencyList, nodeMap, ['Prerequisites', 'SubjectChoice']);
    const parentProgramsOrByProxy = [];
    parentProgramsOrByProxy.push(...getParentsByType(node, visibleNodes, adjacencyList, nodeMap, ['Program', 'Major', 'Minor']));
    for (const prerequisite of parentPrerequisites){
        parentProgramsOrByProxy.push(...getParentsByType(prerequisite, visibleNodes, adjacencyList, nodeMap, ['Program', 'Major', 'Minor', 'SubjectChoice']));
    }
    const parentChoices = parentProgramsOrByProxy.filter(p=>p.data.type==='SubjectChoice');
    for (const choice of parentChoices) {
        parentProgramsOrByProxy.push(...getParentsByType(choice, visibleNodes, adjacencyList, nodeMap, ['Program', 'Major', 'Minor']));
    }
    console.log(JSON.stringify(parentProgramsOrByProxy))
    return parentProgramsOrByProxy.length > 0;
}

