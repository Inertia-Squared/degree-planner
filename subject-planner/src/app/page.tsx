"use client";
import dynamic from "next/dynamic";
import { RefObject, useCallback, useEffect, useState } from "react";
import { GraphCanvasRef, GraphEdge } from "reagraph";
import InfoPanel from "@/components/InfoPanel";
import { CourseTimeline } from "@/components/CourseTimeline";
import {
    ExtendedNode,
    Generic,
    GraphColourProps,
    GraphCommonProps,
    GraphFilterProps,
    GraphPruningProps,
    Program,
    StudyPeriod,
    StudyPeriodItem,
    Subject,
} from "@/utils/types";
import { displayMode } from "@/utils/consts";
import ProgramWindow from "@/components/ui/ProgramWindow";
import { applyClassificationFilters, applyGraphFilters } from "@/lib/graph/graphFilters";
import { useGraphConnection } from "@/hooks/useGraphConnection";
import { useProgram } from "@/hooks/useProgram";
import { useSubjectCriteria } from "@/hooks/useSubjectCriteria";
import { applyGraphColours } from "@/lib/graph/graphColours";
import Header from "@/components/ui/layout/Header";
import { applyGraphLabels } from "@/lib/graph/graphLabels";
import ShowIneligible from "@/components/ShowIneligible";

// todo fix failure-case for Ba. of Arts, Ma. 0026 & Mi. 0024

const ForceGraph = dynamic(() => import("../components/ForceGraph"), {
    ssr: false,
});

// Interfaces above
export default function Home() {
    const [nodes, setNodes] = useState<ExtendedNode<Generic>[]>([]);
    const [displayedNodes, setDisplayedNodes] = useState<ExtendedNode<Generic>[]>([]);
    const [nodeMap, setNodeMap] = useState<Map<string, ExtendedNode<Generic>>>(new Map());
    const [adjacencyList, setAdjacencyList] = useState<Map<string, string[]>>(new Map());
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [displayedEdges, setDisplayedEdges] = useState<GraphEdge[]>([]);
    const [addedNodes, setAddedNodes] = useState<ExtendedNode<Generic>[]>([]);
    const [clusterOptions, setClusterOptions] = useState(["select a node to see cluster options"]);
    const [clusterBy, setClusterBy] = useState<string | undefined>(undefined);
    const [selectedElement, setSelectedElement] = useState<ExtendedNode<Generic> | GraphEdge | undefined>(undefined);
    const [selectedProgram, setSelectedProgram] = useState<ExtendedNode<Program> | undefined>(undefined);
    const [selectedProgramSequence, setSelectedProgramSequence] = useState<string | undefined>(undefined);
    const [showPotentialElectives, setShowPotentialElectives] = useState<boolean>(false);
    const [startPeriod, setStartPeriod] = useState<StudyPeriod>("autumn");
    const [completedPeriods, setCompletedPeriods] = useState<StudyPeriodItem[]>([]);
    const [currentPeriod, setCurrentPeriod] = useState<StudyPeriodItem>({
        period: startPeriod,
        subjectsTaken: [],
    });
    const [subjectsTaken, setSubjectsTaken] = useState<ExtendedNode<Subject>[]>([]);

    const [hideInfo, setHideInfo] = useState<boolean>(true);
    const [showLineup, setShowLineup] = useState<boolean>(false);
    const [updateToggle, setUpdateToggle] = useState<boolean>(false);
    const [showSequences, setShowSequences] = useState<boolean>(true);
    const [showHelp, setShowHelp] = useState<boolean>(false);
    const [showTimeLine, setShowTimeLine] = useState(false);
    const [graphRef, setGraphRef] = useState<RefObject<GraphCanvasRef | null>>();

    const [showAllIneligible, setShowAllIneligible] = useState(false);

    const getNodeFromId = useCallback(
        (id: string) => {
            return nodes.find((n) => n.id === id);
        },
        [nodes],
    );

    const { expandConnected } = useGraphConnection({
        nodes,
        edges,
        setNodes,
        setEdges,
        setNodeMap,
        setAdjacencyList,
        setAddedNodes,
        getNodeFromId,
        graphRef,
    });
    const { searchProgram } = useProgram({ nodes, setNodes, setSelectedProgram, setSelectedProgramSequence });
    const {
        forceAddSpecialisation,
        startExploring,
        selectElement,
        onNodeDoubleClicked,
        moveToNewPeriod,
        getCompletedSubjects,
        isOfferedInCurrentPeriod,
        hasTaken,
    } = useSubjectCriteria({
        nodes,
        selectedProgram,
        setNodes,
        edges,
        setEdges,
        currentPeriod,
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
        setHideInfo,
    });

    function resetSelectedElement() {
        setSelectedElement(undefined);
        setClusterOptions(["Select a node to see cluster options"]);
        setClusterBy(undefined);
        setHideInfo(true);
    }

    function onToggleShowIneligible(shouldShow: boolean) {
        setShowAllIneligible(shouldShow);
    }

    useEffect(() => {
        const commonProps: GraphCommonProps = {
            adjacencyList: adjacencyList,
            edges: edges,
            nodeMap: nodeMap,
            nodes: nodes,
        };

        const filterProps: GraphFilterProps = {
            selectedProgram: selectedProgram,
            selectedProgramSequence: selectedProgramSequence,
            showPotentialElectives: showPotentialElectives,
            ...commonProps,
        };
        const colourProps: GraphColourProps = {
            getCompletedSubjects: getCompletedSubjects,
            hasTaken: hasTaken,
            isOfferedInCurrentPeriod: isOfferedInCurrentPeriod,
            ...commonProps,
        };

        let { newNodes, newEdges } = applyGraphFilters(filterProps);
        applyGraphColours(colourProps);
        const pruningProps: GraphPruningProps = {
            newNodes: newNodes,
            newEdges: newEdges,
            adjacencyList: adjacencyList,
            showAllIneligible: showAllIneligible,
        };
        const newValues = applyClassificationFilters(pruningProps);
        newNodes = newValues.newNodes;
        newEdges = newValues.newEdges;

        applyGraphLabels(newNodes);

        setDisplayedNodes(newNodes);
        setDisplayedEdges(newEdges);
        if (addedNodes.length > 0) expandConnected(addedNodes);
    }, [
        addedNodes,
        adjacencyList,
        edges,
        expandConnected,
        getCompletedSubjects,
        hasTaken,
        isOfferedInCurrentPeriod,
        nodeMap,
        nodes,
        selectedProgram,
        selectedProgramSequence,
        showPotentialElectives,
        showAllIneligible,
    ]);

    return (
        <>
            <Header
                showHelp={showHelp}
                onSetShowHelp={setShowHelp}
                showLineup={showLineup}
                setShowLineup={setShowLineup}
                showTimeLine={showTimeLine}
                setShowTimeLine={setShowTimeLine}
            />

            <main className={`h-[100vh] py-16 flex flex-col ${showLineup ? "p-2" : "pb-2 px-2"}`}>
                <ForceGraph
                    layoutMode={displayMode}
                    clickAction={selectElement}
                    clickCanvas={resetSelectedElement}
                    clusterBy={clusterBy}
                    doubleClickNodeAction={onNodeDoubleClicked}
                    className={`grow w-full h-full absolute top-0 left-0 z-10`}
                    edges={displayedEdges}
                    nodes={displayedNodes}
                    setGraphRef={setGraphRef}
                />
                <ProgramWindow
                    searchProgram={searchProgram}
                    forceAddSpecialisation={forceAddSpecialisation}
                    startExploring={startExploring}
                    showLineup={showLineup}
                    setShowLineup={setShowLineup}
                    setClusterBy={setClusterBy}
                    clusterOptions={clusterOptions}
                    setShowPotentialElectives={setShowPotentialElectives}
                    showSequences={showSequences}
                    setSelectedProgramSequence={setSelectedProgramSequence}
                    setStartPeriod={setStartPeriod}
                    setCurrentPeriod={setCurrentPeriod}
                    selectedProgram={selectedProgram}
                    completedPeriods={completedPeriods}
                    currentPeriod={currentPeriod}
                />
                <CourseTimeline
                    className={`bg-gray-50 h-fit min-h-[70vh] z-20 max-w-1/5 absolute top-20 left-2 border-none shadow-lg p-4`}
                    completedPeriods={completedPeriods}
                    currentPeriod={currentPeriod}
                    onSkipPeriod={moveToNewPeriod}
                    showTimeLine={showTimeLine}
                    setShowTimeLine={setShowTimeLine}
                />
                <InfoPanel
                    className={`bg-gray-50 min-w-[400px] w-fit z-20 max-h-[45vw] max-w-1/5 shadow-lg p-4 absolute top-20 right-2`}
                    item={selectedElement}
                    showKey={hideInfo}
                    setShowKey={setHideInfo}
                />
                <ShowIneligible
                    className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit z-20 max-h-1/2 max-w-1/5 border-2 absolute right-1 bottom-0 my-auto`}
                    onToggle={onToggleShowIneligible}
                />
                {/*<a href={'https://github.com/Inertia-Squared/degree-planner'} target={'_blank'} className={`fixed top-0 right-0 w-8 h-8 z-40 m-3`}><BsGithub size={32}/></a>*/}
            </main>
        </>
    );
}
