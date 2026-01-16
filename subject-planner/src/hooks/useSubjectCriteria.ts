import { GraphEdge } from "reagraph";
import {
    ExtendedNode,
    Generic,
    Major,
    Minor,
    OfferStatus,
    Prerequisite,
    Program,
    StudyPeriod,
    StudyPeriodItem,
    Subject,
} from "@/utils/types";
import { Dispatch, SetStateAction, useCallback, useRef } from "react";
import { badClusterOptions } from "@/utils/consts";
import {
    asStudyPeriod,
    getParentsByType,
    isMajorNode,
    isMinorNode,
    isProgramNode,
    isSubjectNode
} from "@/lib/graph/graphUtil";
import { isEligibleForSubject } from "@/lib/graph/graphColours";

export function useSubjectCriteria({
  nodes,
  selectedProgram,
  setNodes,
  edges,
  setEdges,
  currentPeriod,
  setFirstShowLineup,
  setShowLineup,
  expandConnected,
  setSelectedElement,
  setSelectedProgram,
  setSelectedProgramSequence,
  setClusterOptions,
  completedPeriods,
  subjectsTaken,
  setUpdateToggle,
  updateToggle,
  adjacencyList,
  nodeMap,
  setShowSequences,
  setSubjectsTaken,
  setCurrentPeriod,
  setCompletedPeriods,
  startPeriod,
  setShowKey
}: {
  nodes: ExtendedNode<Generic>[];
  selectedProgram: ExtendedNode<Program> | undefined;
  setNodes: Dispatch<SetStateAction<ExtendedNode<Generic>[]>>;
  edges: GraphEdge[];
  setEdges: Dispatch<SetStateAction<GraphEdge[]>>;
  currentPeriod: StudyPeriodItem;
  setFirstShowLineup: Dispatch<SetStateAction<boolean>>;
  setShowLineup: Dispatch<SetStateAction<boolean>>;
  expandConnected: (nodesToExpand: ExtendedNode<Generic>[]) => Promise<void>;
  setSelectedElement: Dispatch<SetStateAction<ExtendedNode<Generic> | GraphEdge | undefined>>;
  setSelectedProgram: Dispatch<SetStateAction<ExtendedNode<Program> | undefined>>;
  setSelectedProgramSequence: Dispatch<SetStateAction<string | undefined>>;
  setClusterOptions: Dispatch<SetStateAction<string[]>>;
  completedPeriods: StudyPeriodItem[];
  subjectsTaken: ExtendedNode<Subject>[];
  setUpdateToggle: Dispatch<SetStateAction<boolean>>;
  updateToggle: boolean;
  adjacencyList: Map<string, string[]>;
  nodeMap: Map<string, ExtendedNode<Generic>>;
  setShowSequences: Dispatch<SetStateAction<boolean>>;
  setSubjectsTaken: Dispatch<SetStateAction<ExtendedNode<Subject>[]>>;
  setCurrentPeriod: Dispatch<SetStateAction<StudyPeriodItem>>;
  setCompletedPeriods: Dispatch<SetStateAction<StudyPeriodItem[]>>;
  startPeriod: StudyPeriod;
  setShowKey: Dispatch<SetStateAction<boolean>>;
}) {
    const recentlyAdded = useRef<Set<string>>(new Set());

    const getNodeFromId = useCallback(
        (id: string) => {
            return nodes.find((n) => n.id === id);
        },
        [nodes]
    );

    const forceAddSpecialisation = (node: ExtendedNode<Major | Minor>) => {
        if (!node.data.programConnectionId || !selectedProgram) return;
        if (nodes.includes(node)) return;
        node.size = 40;
        const newNodes = [...nodes.filter((n) => n.data.type !== node.data.type), node];
        setNodes(newNodes);
        const newEdgeId = node.data.programConnectionId + ":" + selectedProgram.id + node.id;
        const newEdge: GraphEdge = {
            id: newEdgeId,
            source: selectedProgram.id,
            target: node.id,
            label: "HAS_SPECIALISATION",
        };
        const newEdges = [...edges.filter((e) => newNodes.find((n) => n.id === e.target)), newEdge];
        setEdges(newEdges);
    };
    const newEdges = [...edges.filter((e) => newNodes.find((n) => n.id === e.target)), newEdge];
    setEdges(newEdges);
  };

  const isOfferedInCurrentPeriod = useCallback(
    (node: ExtendedNode<Subject>): OfferStatus => {
      if (!node.data.teachingPeriods || node.data.teachingPeriods.length < 1)
        return OfferStatus.UNKNOWN;
      let offerStatus: OfferStatus = OfferStatus.NO;
      node.data.teachingPeriods.map((p) => {
        if (offerStatus === OfferStatus.NO && asStudyPeriod(p) === "unknown")
          offerStatus = OfferStatus.UNKNOWN;
        if (asStudyPeriod(p) === currentPeriod.period) offerStatus = OfferStatus.YES;
      });
      return offerStatus;
    },
    [currentPeriod.period]
  );

  async function startExploring() {
    const newNodes = nodes.filter((n) => isProgramNode(n) || isMinorNode(n) || isMajorNode(n));
    setNodes(newNodes);
    setFirstShowLineup(false);
    setShowLineup(false);
    expandConnected(newNodes);
  }

  function selectElement(id: string, isNode: boolean = true) {
    const element = isNode ? nodes.find((n) => n.id === id) : edges.find((e) => e.id === id);
    setSelectedElement(element);
    setShowKey(false);
    if (isNode) {
      if (element && isProgramNode(element)) {
        setSelectedProgram(element);
        const sequences = element.data["programSequences"];
        if (sequences.length > 0) setSelectedProgramSequence(sequences[0]);
      }
      setClusterOptions(
        Object.keys(element?.data).filter((key) => !badClusterOptions.find((o) => o == key))
      );
    }

    function selectElement(id: string, isNode: boolean = true) {
        const element = isNode ? nodes.find((n) => n.id === id) : edges.find((e) => e.id === id);
        setSelectedElement(element);
        if (isNode) {
            if (element && isProgramNode(element)) {
                setSelectedProgram(element);
                const sequences = element.data["programSequences"];
                if (sequences.length > 0) setSelectedProgramSequence(sequences[0]);
            }
            setClusterOptions(
                Object.keys(element?.data).filter((key) => !badClusterOptions.find((o) => o == key))
            );
        }
    }
    const getCompletedSubjects = useCallback(() => {
        return completedPeriods.map((p) => p.subjectsTaken).flat();
    }, [completedPeriods]);

    const hasTaken = useCallback(
        (node: ExtendedNode<Generic>) => {
            return subjectsTaken.some((n) => n.id === node.id);
        },
        [subjectsTaken]
    );

    function onNodeDoubleClicked(id: string) {
        if (recentlyAdded.current.has(id)) return;

        // console.log('Checking node...')
        setUpdateToggle(!updateToggle);

        const node = getNodeFromId(id);
        if (node && isSubjectNode(node)) {
            if (hasTaken(node)) {
                return;
            }
            const parentPrerequisites = getParentsByType<Prerequisite>(
                node,
                nodes,
                adjacencyList,
                nodeMap,
                "Prerequisites"
            ).filter((p) => p.data.forSubject === node.data.code);
            if (
                !isEligibleForSubject(parentPrerequisites, getCompletedSubjects()) ||
                isOfferedInCurrentPeriod(node) === OfferStatus.NO
            ) {
                return;
            }

            // Double check if already in current period
            if (currentPeriod.subjectsTaken.some(n => n.id === node.id)) return;

            recentlyAdded.current.add(id);
            setTimeout(() => {
                recentlyAdded.current.delete(id);
            }, 1000);

            setShowSequences(false);

            let newCurrentPeriod = { ...currentPeriod };
            newCurrentPeriod.subjectsTaken = [...newCurrentPeriod.subjectsTaken, node];
            setSubjectsTaken([...subjectsTaken, node]);
            if (newCurrentPeriod.subjectsTaken.length % 4 === 0) {
                moveToNewPeriod(newCurrentPeriod);
            } else {
                setCurrentPeriod(newCurrentPeriod);
            }
        }
    }

    function moveToNewPeriod(oldCurrentPeriod: StudyPeriodItem) {
        const newCompletedPeriods = [...(completedPeriods ?? []), oldCurrentPeriod];

        if ((completedPeriods?.length ?? 0) % 2 === 0 && completedPeriods.length !== 0) {
            setCompletedPeriods(newCompletedPeriods);
            setCurrentPeriod({
                period: startPeriod,
                subjectsTaken: [],
            });
        } else {
            setCompletedPeriods(newCompletedPeriods);
            setCurrentPeriod({
                period: startPeriod === "autumn" ? "spring" : "autumn",
                subjectsTaken: [],
            });
        }
    }

    return {
        forceAddSpecialisation,
        startExploring,
        selectElement,
        onNodeDoubleClicked,
        moveToNewPeriod,
        getCompletedSubjects,
        isOfferedInCurrentPeriod,
        hasTaken,
    };
}
