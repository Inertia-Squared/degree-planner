import {GraphEdge} from "reagraph";
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
import {Dispatch, SetStateAction, useCallback, useRef} from "react";
import {badClusterOptions} from "@/utils/consts";
import {
    asStudyPeriod,
    getParentsByType,
    isMajorNode,
    isMinorNode,
    isProgramNode,
    isSubjectNode
} from "@/lib/graph/graphUtil";
import {isEligibleForSubject} from "@/lib/graph/graphColours";
import {HeaderItem} from "@/components/ui/layout/Containers/HeaderBar";

export function useSubjectCriteria({
  setSelectedHeaderItem,
  setSelectedElement,
  setClusterOptions,
  setUpdateToggle,
  updateToggle,
  setShowSequences,
  setShowInfo,
}: {
  setSelectedHeaderItem: Dispatch<SetStateAction<HeaderItem>>;
  setSelectedElement: Dispatch<SetStateAction<ExtendedNode<Generic> | GraphEdge | undefined>>;
  setClusterOptions: Dispatch<SetStateAction<string[]>>;
  setUpdateToggle: Dispatch<SetStateAction<boolean>>;
  updateToggle: boolean;
  setShowSequences: Dispatch<SetStateAction<boolean>>;
  setShowInfo: Dispatch<SetStateAction<boolean>>;
}) {



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
    setSelectedHeaderItem(HeaderItem.NONE);
    setExploringStarted(true);
    setCurrentPeriod({period: startPeriod, subjectsTaken: subjectsTaken});
    expandConnected(newNodes);
  }

  function selectElement(id: string, isNode: boolean = true) {
    const element = isNode ? nodes.find((n) => n.id === id) : edges.find((e) => e.id === id);
    setSelectedElement(element);
    setShowInfo(true);
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



    function moveToNewPeriod(oldCurrentPeriod: StudyPeriodItem) {
        const newCompletedPeriods = [...(completedPeriods ?? []), oldCurrentPeriod];
        setCurrentPeriod({
            period: currentPeriod.period === "autumn" ? "spring" : "autumn",
            subjectsTaken: [],
        });
        setCompletedPeriods(newCompletedPeriods);
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
