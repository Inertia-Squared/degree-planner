import { isEligibleForSubject, isRequiredByProgramOrSpecialisation, prerequisiteIsFulfilled, RequiredType } from "@/lib/graph/graphColours";
import { fromNodesById, isPrerequisiteNode, isSubjectNode } from "./funcs";
import { HEXGBA, nodeFillMap } from "@/lib/siteUtil";
import { colours } from "./consts";
import { ExtendedNode, Generic, OfferStatus, Prerequisite, Program, Subject } from "./types";
import { getParentsByType } from "@/lib/graph/graphUtil";
import { filterDisconnectedEdges, filterImpossiblePrerequisites, filterLeafPrerequisites, filterPrerequisitesNotInCourse, filterSubjectsNotInSequence } from "@/lib/graph/graphFilters";
import { GraphEdge } from "reagraph";

// These functions are utilised in useEffect of page.tsx file
export function nodeFilters(
    nodes: ExtendedNode<Generic>[],
    edges: GraphEdge[],
    adjacencyList: Map<string, string[]>,
    nodeMap: Map<string, ExtendedNode<Generic>>,
    selectedProgram: ExtendedNode<Program> | undefined,
    selectedProgramSequence: string | undefined,
    showPotentialElectives: boolean,
    getCompletedSubjects: () => ExtendedNode<Subject>[],
    isOfferedInCurrentPeriod: (node: ExtendedNode<Subject>) => OfferStatus,
    hasTaken: (node: ExtendedNode<Generic>) => boolean
) {
  let newNodes = [...nodes];
  let newEdges = [...edges];

  // Filter nodes not in selected sequence
  if (selectedProgram && selectedProgramSequence) {
    newNodes = newNodes.filter(n => {
      if (!isSubjectNode(n)) return true;
      return filterSubjectsNotInSequence(
        n,
        selectedProgram.data.programName,
        selectedProgramSequence
      );
    });
  }

  // Filter prerequisites not part of course
  if (selectedProgram) {
    newNodes = newNodes.filter(n => {
      if (!isPrerequisiteNode(n)) return true;
      return filterPrerequisitesNotInCourse(
        n,
        selectedProgram.data.programName
      );
    });
  }

  // Filter potential electives
  if (!showPotentialElectives) {
    newNodes = newNodes.filter(n => {
      if (!isSubjectNode(n) || !n.fill) return true;
      return (
        isRequiredByProgramOrSpecialisation(
          n,
          newNodes,
          adjacencyList,
          nodeMap,
          edges
        ) !== RequiredType.NOT_REQUIRED
      );
    });
  }

  // Filter impossible prerequisites
  newNodes = newNodes.filter(n => {
    if (!isPrerequisiteNode(n)) return true;
    const subjectNodes = newNodes.filter(nn => isSubjectNode(nn));
    return filterImpossiblePrerequisites(n, subjectNodes);
  });

  // Filter edges for removed nodes
  newEdges = newEdges.filter(e => filterDisconnectedEdges(e, newNodes));

  // Filter edges where prerequisite target is gone
  newEdges = newEdges.filter(e => {
    return !(
      e.label === "PREREQUISITE_FOR" &&
      !isPrerequisiteNode(fromNodesById(e.target, newNodes))
    );
  });

  // Filter nodes with too many prerequisites but none visible
  newNodes = newNodes.filter(n => {
    if (!isSubjectNode(n)) return true;
    return !(
      n.data.prerequisites.length > 3 &&
      getParentsByType<Prerequisite>(
        n,
        newNodes,
        adjacencyList,
        nodeMap,
        "Prerequisites"
      ).filter(p => p.data.forSubject === n.data.code).length < 1
    );
  });

  newNodes = newNodes.filter(n => {
    if (!isPrerequisiteNode(n)) return true;
    return filterLeafPrerequisites(n, newEdges);
  });

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
          n.fill = new HEXGBA("#994499").toHex();
        } else {
          if (!hasTaken(n)) n.fill = new HEXGBA(n.fill).multiply(0.6).toHex();
        }
      }
    }
  });

  newNodes.forEach(n => {
    if (!isSubjectNode(n) || !n.fill) return;
    if (!hasTaken(n)) {
      if (n.fill !== colours.inaccessible)
        n.fill = new HEXGBA(n.fill).multiply(0.75).toHex();
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

  return { newNodes, newEdges };
}
