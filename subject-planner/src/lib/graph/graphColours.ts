import {LogicalPrerequisite} from "../../../../data-scraping/neo4j/upload-data-to-db";
import {
    getAsLogicalPrerequisite,
    getParentsByType,
    isChoiceNode,
    isPrerequisiteNode,
    isSubjectNode
} from "@/lib/graph/graphUtil";
import {ExtendedNode, Generic, GraphColourProps, OfferStatus, Prerequisite, Subject} from "@/utils/types";
import {GraphEdge} from "reagraph";
import {colours, nodeFillMap} from "@/utils/consts";
import {HEXRGBA} from "@/lib/RGBA";

/**
 * Runs several passes through visible nodes to colour-code them based on specific criteria
 * Assumes that nodes have already been preprocessed and pruned by the filter process.
 * @param colourProps
 */
export function applyGraphColours(
    colourProps: GraphColourProps
){
    const {nodes, edges, adjacencyList, nodeMap, getCompletedSubjects, isOfferedInCurrentPeriod, hasTaken} = colourProps;

    let newNodes = [...nodes];
    let newEdges = [...edges]; // todo this stays in since we may highlight/colour-code edges soon

    newNodes.forEach(n => {
        if (!isSubjectNode(n)) return;
        const parentPrereq = getParentsByType<Prerequisite>(
            n,
            newNodes,
            adjacencyList,
            nodeMap,
            "Prerequisites"
        ).filter(p => p.data.forSubject === n.data.code);

        if (
            isEligibleForSubject(parentPrereq, getCompletedSubjects()) &&
            isOfferedInCurrentPeriod(n) !== OfferStatus.NO
        ) {
            n.fill = nodeFillMap["Subject"];
        } else {
            if (!hasTaken(n)) n.fill = colours.inaccessible;
        }
    });

    newNodes.forEach(n => {
        if (!isSubjectNode(n) || !n.fill) return;
        const required = isRequiredByProgramOrSpecialisation(
            n,
            newNodes,
            adjacencyList,
            nodeMap,
            edges
        );
        if (required !== RequiredType.REQUIRED) {
            if (n.fill !== colours.inaccessible) {
                if (required === RequiredType.NOT_REQUIRED) {
                    n.fill = new HEXRGBA("#994499").toHex();
                } else {
                    if (!hasTaken(n)) n.fill = new HEXRGBA(n.fill).multiply(0.6).toHex();
                }
            }
        }
    });

    newNodes.forEach(n => {
        if (!isSubjectNode(n) || !n.fill) return;
        if (!hasTaken(n)) {
            if (n.fill !== colours.inaccessible)
                n.fill = new HEXRGBA(n.fill).multiply(0.75).toHex();
        }
    });

    newNodes.forEach(n => {
        if (!isPrerequisiteNode(n)) return;
        if (prerequisiteIsFulfilled(n, getCompletedSubjects())) {
            n.fill = nodeFillMap["Prerequisites"];
        } else {
            n.fill = colours.inaccessible;
        }
    });
}

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

