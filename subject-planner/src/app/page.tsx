"use client";
import dynamic from "next/dynamic";
import {useCallback, useEffect, useState} from "react";
import {GraphEdge} from "reagraph";
import InfoPanel from "@/components/InfoPanel";
import {CourseTimeline} from "@/components/CourseTimeline";
import {
    ExtendedNode,
    Generic, GraphColourProps, GraphCommonProps, GraphFilterProps,
    Program,
    StudyPeriod,
    StudyPeriodItem,
    Subject,
} from "@/utils/types";
import HelpWindow from "@/components/ui/HelpWindow";
import {displayMode} from "@/utils/consts";
import ProgramWindow from "@/components/ui/ProgramWindow";
import NodeReference from "@/components/ui/NodeReferrence";
import LineupWindow from "@/components/ui/LineupWindow";
import {applyGraphFilters} from "@/lib/graph/graphFilters";
import {useGraphConnection} from "@/hooks/useGraphConnection";
import {useProgram} from "@/hooks/useProgram";
import {useSubjectCriteria} from "@/hooks/useSubjectCriteria";
import {applyGraphColours} from "@/lib/graph/graphColours";

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
    const [selectedElement, setSelectedElement] = useState<
            ExtendedNode<Generic> | GraphEdge | undefined
    >(undefined);
    const [selectedProgram, setSelectedProgram] = useState<ExtendedNode<Program> | undefined>(
            undefined
    );
    const [selectedProgramSequence, setSelectedProgramSequence] = useState<string | undefined>(
            undefined
    );
    const [showPotentialElectives, setShowPotentialElectives] = useState<boolean>(false);
    const [startPeriod, setStartPeriod] = useState<StudyPeriod>("autumn");
    const [completedPeriods, setCompletedPeriods] = useState<StudyPeriodItem[]>([]);
    const [currentPeriod, setCurrentPeriod] = useState<StudyPeriodItem>({
        period: startPeriod,
        subjectsTaken: [],
    });
    const [subjectsTaken, setSubjectsTaken] = useState<ExtendedNode<Subject>[]>([]);


    const [showLineup, setShowLineup] = useState<boolean>(false);
    const [firstShowLineup, setFirstShowLineup] = useState<boolean>(true);
    const [updateToggle, setUpdateToggle] = useState<boolean>(false);
    const [showSequences, setShowSequences] = useState<boolean>(true);
    const [showKey, setShowKey] = useState<boolean>(false);
    const [firstShowKey, setFirstShowKey] = useState<boolean>(true);
    const [showHelp, setShowHelp] = useState<boolean>(false);
    const [firstShowHelp, setFirstShowHelp] = useState<boolean>(true);

    const getNodeFromId = useCallback(
            (id: string) => {
                return nodes.find((n) => n.id === id);
            },
            [nodes]
    );

    const {expandConnected} = useGraphConnection({
        nodes,
        edges,
        setNodes,
        setEdges,
        setNodeMap,
        setAdjacencyList,
        setAddedNodes,
        getNodeFromId
    })
    const {searchProgram} = useProgram({nodes, setNodes, setSelectedProgram, setSelectedProgramSequence})
    const {
        forceAddSpecialisation, startExploring, selectElement, onNodeDoubleClicked,
        moveToNewPeriod, getCompletedSubjects, isOfferedInCurrentPeriod, hasTaken
    } = useSubjectCriteria({
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
        startPeriod
    })

    function resetSelectedElement() {
        setSelectedElement(undefined);
        setClusterOptions(["select a node to see cluster options"]);
        setClusterBy(undefined);
    }

    useEffect(() => {
        const commonProps: GraphCommonProps = {
            adjacencyList: adjacencyList,
            edges: edges,
            nodeMap: nodeMap,
            nodes: nodes
        }

        const filterProps: GraphFilterProps = {
            selectedProgram: selectedProgram,
            selectedProgramSequence: selectedProgramSequence,
            showPotentialElectives: showPotentialElectives,
            ...commonProps
        }
        const {newNodes, newEdges} = applyGraphFilters(filterProps);

        const colourProps: GraphColourProps = {
            getCompletedSubjects: getCompletedSubjects,
            hasTaken: hasTaken,
            isOfferedInCurrentPeriod: isOfferedInCurrentPeriod,
            ...commonProps
        }
        applyGraphColours(colourProps);

        setDisplayedNodes(newNodes);
        setDisplayedEdges(newEdges);
        if (addedNodes.length > 0) expandConnected(addedNodes);
    }, [addedNodes, adjacencyList, edges, expandConnected, getCompletedSubjects, hasTaken, isOfferedInCurrentPeriod, nodeMap, nodes, selectedProgram, selectedProgramSequence, showPotentialElectives]);

    return (
            <main className={`h-[100vh] flex flex-col ${showLineup ? "p-2" : "pb-2 px-2"}`}>
                <HelpWindow
                        showHelp={showHelp}
                        firstShowHelp={firstShowHelp}
                        onSetShowHelp={setShowHelp}
                        onSetFirstShowHelp={setFirstShowHelp}
                />
                <NodeReference
                        setShowKey={setShowKey}
                        showKey={showKey}
                        firstShowLineup={firstShowLineup}
                        setFirstShowKey={setFirstShowKey}
                        firstShowKey={firstShowKey}
                        nodes={nodes}
                />
                <ForceGraph
                        layoutMode={displayMode}
                        clickAction={selectElement}
                        clickCanvas={resetSelectedElement}
                        clusterBy={clusterBy}
                        doubleClickNodeAction={onNodeDoubleClicked}
                        className={`grow w-full h-full absolute top-0 left-0 z-10`}
                        edges={displayedEdges}
                        nodes={displayedNodes}
                />
                <ProgramWindow
                        searchProgram={searchProgram}
                        forceAddSpecialisation={forceAddSpecialisation}
                        startExploring={startExploring}
                        showLineup={showLineup}
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
                <LineupWindow
                        showLineup={showLineup}
                        firstShowLineup={firstShowLineup}
                        firstShowHelp={firstShowHelp}
                        setShowLineup={setShowLineup}
                />
                <CourseTimeline
                        className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit z-20 max-h-1/2 max-w-1/5 border-2 absolute left-1 bottom-0 my-auto`}
                        completedPeriods={completedPeriods}
                        currentPeriod={currentPeriod}
                        onSkipPeriod={moveToNewPeriod}
                />
                <InfoPanel
                        className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit z-20 max-h-1/2 max-w-1/5 border-2 absolute right-1 bottom-0 my-auto`}
                        item={selectedElement}
                />
                {/*<a href={'https://github.com/Inertia-Squared/degree-planner'} target={'_blank'} className={`fixed top-0 right-0 w-8 h-8 z-40 m-3`}><BsGithub size={32}/></a>*/}
            </main>
    );
}
