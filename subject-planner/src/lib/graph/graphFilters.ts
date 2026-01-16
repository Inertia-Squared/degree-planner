import {isRequiredByProgramOrSpecialisation, prerequisiteIsFulfilled, RequiredType} from "@/lib/graph/graphColours";
import {
    ExtendedNode,
    FilteredReasons,
    Generic,
    GraphFilterProps, GraphPruningProps, NodeStatus,
    Prerequisite,
    Subject
} from "@/utils/types";
import {fromNodesById, getCourseCode, getParentsByType, isPrerequisiteNode, isSubjectNode} from "@/lib/graph/graphUtil";
import {GraphEdge} from "reagraph";

export function filterSubjectsNotInSequence(node: ExtendedNode<Subject>, selectedProgram: string, selectedSequence: string) {
  let isInSelectedSequence = false;
  if (node.data.subjectSequences.length < 1) return true;
  if (!node.data.subjectSequences.find(s => s.includes(selectedProgram))) {
    return true;
  }
  node.data.subjectSequences.forEach((sequence: string) => {
    if (sequence.toLowerCase().includes(selectedSequence.toLowerCase()) || sequence.length < 1) isInSelectedSequence = true;
  });
  return isInSelectedSequence;
}

export function filterPrerequisitesNotInCourse(node: ExtendedNode<Prerequisite>, selectedProgramName: string) {
  const programCode = getCourseCode(selectedProgramName);
  if (programCode === 'nomatch') {
    return true; // we don't have enough info to determine
  }
  const nodeCourse = node.data.course;
  return (nodeCourse === programCode || nodeCourse === 'any' || nodeCourse === 'SPECIAL');
}

export function filterDisconnectedEdges(edge: GraphEdge, visibleNodes: ExtendedNode<any>[]) {
  let hasSource = false;
  let hasTarget = false;
  visibleNodes.forEach(node => {
    if (edge.source === node.id) hasSource = true;
    if (edge.target === node.id) hasTarget = true;
  });
  return hasSource && hasTarget;
}

export function filterLeafPrerequisites(node: ExtendedNode<Prerequisite>, edges: GraphEdge[]) {
  let hasTarget = false;
  edges.forEach((edge) => {
    if (edge.source === node.id && edge.label === 'PATHWAY_TO') hasTarget = true;
  });
  return hasTarget;
}

export function filterImpossiblePrerequisites(node: ExtendedNode<Prerequisite>, nodes: ExtendedNode<Subject>[]) {
  return prerequisiteIsFulfilled(node, nodes);
}


// These functions are utilised in useEffect of page.tsx file
export function applyGraphFilters(
    filterProps: GraphFilterProps,
): {newNodes: ExtendedNode<Generic>[], newEdges: GraphEdge[]}  {
  const {nodes, edges, adjacencyList, nodeMap, selectedProgram, selectedProgramSequence, showPotentialElectives} = filterProps;
  let newNodes = [...nodes];
  let newEdges = [...edges];

  newNodes.forEach(n => n.data.filtered = FilteredReasons.NONE);

  // Filter nodes not in selected sequence
  if (selectedProgram && selectedProgramSequence) {
    newNodes = newNodes.filter(n => {
      if (!isSubjectNode(n)) return true;
      const isInSequence = filterSubjectsNotInSequence(
        n,
        selectedProgram.data.programName,
        selectedProgramSequence
      );
      if (!isInSequence) n.data.filtered = FilteredReasons.SUBJECT_NOT_IN_SEQUENCE;
      return isInSequence;
    });
  }

  // Filter prerequisites not part of course
  if (selectedProgram) {
    newNodes = newNodes.filter(n => {
      if (!isPrerequisiteNode(n)) return true;
      const isInCourse = filterPrerequisitesNotInCourse(
        n,
        selectedProgram.data.programName
      );
      if (!isInCourse) n.data.filtered = FilteredReasons.PREREQUISITE_NOT_IN_COURSE;
      return isInCourse;
    });
  }

  // Filter potential electives
  if (!showPotentialElectives) {
    newNodes = newNodes.filter(n => {
      if (!isSubjectNode(n) || !n.fill) return true;
      const isRequired = isRequiredByProgramOrSpecialisation(
          n,
          newNodes,
          adjacencyList,
          nodeMap,
          edges
        ) !== RequiredType.NOT_REQUIRED;
      if (!isRequired) n.data.filtered = FilteredReasons.NOT_REQUIRED_ELECTIVE;
      return isRequired;
    });
  }

  // Filter impossible prerequisites
  newNodes = newNodes.filter(n => {
    if (!isPrerequisiteNode(n)) return true;
    const subjectNodes = newNodes.filter(nn => isSubjectNode(nn));
    const isPossible = filterImpossiblePrerequisites(n, subjectNodes);
    if (!isPossible) n.data.filtered = FilteredReasons.IMPOSSIBLE_PREREQUISITE;
    return isPossible;
  });

  // Filter edges for removed nodes
  newEdges = newEdges.filter(e => filterDisconnectedEdges(e, newNodes));

  // Filter edges where prerequisite target is gone
  newEdges = newEdges.filter(e => {
    const isDangling = e.label === "PREREQUISITE_FOR" &&
      !isPrerequisiteNode(fromNodesById(e.target, newNodes));
    if (isDangling) {
        const sourceNode = fromNodesById(e.source, newNodes);
        if (sourceNode) {
            sourceNode.data.filtered = FilteredReasons.DANGLING_PREREQUISITE_SUBJECT;
        }
    }
    return !isDangling;
  });

  // Filter nodes with too many prerequisites but none visible
  newNodes = newNodes.filter(n => {
    if (!isSubjectNode(n)) return true;
    const hasVisiblePrereqs = !(
      n.data.prerequisites.length > 3 &&
      getParentsByType<Prerequisite>(
        n,
        newNodes,
        adjacencyList,
        nodeMap,
        "Prerequisites"
      ).filter(p => p.data.forSubject === n.data.code).length < 1
    );
    if (!hasVisiblePrereqs) n.data.filtered = FilteredReasons.DANGLING_PREREQUISITE_SUBJECT;
    return hasVisiblePrereqs;
  });

  newNodes = newNodes.filter(n => {
    if (!isPrerequisiteNode(n)) return true;
    const isLeaf = filterLeafPrerequisites(n, newEdges);
    if (!isLeaf) n.data.filtered = FilteredReasons.LEAF_PREREQUISITE_NODE;
    return isLeaf;
  });

  return { newNodes, newEdges };
}

export function applyClassificationFilters(pruningProps: GraphPruningProps
): {newNodes: ExtendedNode<Generic>[], newEdges: GraphEdge[]} {
    let {newNodes, newEdges, adjacencyList, showAllIneligible} = pruningProps;
    if (!showAllIneligible) {
        newNodes = newNodes.filter(n=>{
            if (isSubjectNode(n) && n.data.status === NodeStatus.INELIGIBLE) return false;

            if (isPrerequisiteNode(n)) {
                if (n.data.status === NodeStatus.INELIGIBLE){
                    const adjacentNodes = adjacencyList.get(n.id);
                    if (!adjacentNodes) return false;
                    for (let id of adjacentNodes){
                        const node = fromNodesById(id, newNodes);
                        if (!node) return false;
                        if (isSubjectNode(node) && node.data.status !== NodeStatus.INELIGIBLE) {
                            return true;
                        }
                    }
                    return false;
                }
                return true;
            }

            return true;
        });

        // Filter edges for removed nodes (2nd pass)
        newEdges = newEdges.filter(e => filterDisconnectedEdges(e, newNodes));
    }
    return {newNodes, newEdges};
}
