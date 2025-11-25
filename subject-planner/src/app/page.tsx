"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GraphEdge } from "reagraph";
import { getProgramsInterface } from "@/app/api/graph/getPrograms/route";
import { getConnectedNodesInterface } from "@/app/api/graph/getConnected/route";
import { HEXGBA, nodeFillMap } from "@/lib/siteUtil";
import InfoPanel from "@/components/InfoPanel";
import {
  filterDisconnectedEdges,
  filterImpossiblePrerequisites,
  filterLeafPrerequisites,
  filterPrerequisitesNotInCourse,
  filterSubjectsNotInSequence,
} from "@/lib/graph/graphFilters";
import {
  isEligibleForSubject,
  isRequiredByProgramOrSpecialisation,
  prerequisiteIsFulfilled,
  RequiredType,
} from "@/lib/graph/graphColours";
import { getParentsByType } from "@/lib/graph/graphUtil";
import { CourseTimeline } from "@/components/CourseTimeline";
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
import {
  asStudyPeriod,
  chooseNode,
  fromNodesById,
  isMajorNode,
  isMinorNode,
  isPrerequisiteNode,
  isProgramNode,
  isSubjectNode,
} from "@/utils/funcs";
import HelpWindow from "@/components/ui/HelpWindow";
import { badClusterOptions, colours, displayMode } from "@/utils/consts";
import ProgramWindow from "@/components/ui/ProgramWindow";
import NodeReferrence from "@/components/ui/NodeReferrence";
import LineupWindow from "@/components/ui/LineupWindow";

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
  const [showLineup, setShowLineup] = useState<boolean>(false);
  const [firstShowLineup, setFirstShowLineup] = useState<boolean>(true);
  const [updateToggle, setUpdateToggle] = useState<boolean>(false);
  const [showSequences, setShowSequences] = useState<boolean>(true);
  const [subjectsTaken, setSubjectsTaken] = useState<ExtendedNode<Subject>[]>([]);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [firstShowKey, setFirstShowKey] = useState<boolean>(true);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [firstShowHelp, setFirstShowHelp] = useState<boolean>(true);

  const searchProgram = async (searchString: string) => {
    const response = await fetch(`/api/graph/getPrograms?programName=${searchString}`);
    if (!response.ok) {
      throw new Error(
        `Failed to get programs at /api/graph/getPrograms with search string ${searchString}`
      );
    }

    const data = (await response.json()) as getProgramsInterface;
    if (data.programs !== nodes) setNodes(data.programs);
    setSelectedProgram(data.programs[0] as ExtendedNode<Program>);
    setSelectedProgramSequence(data.programs[0].data.programSequences[0]);
  };

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

  const getNodeFromId = useCallback(
    (id: string) => {
      return nodes.find((n) => n.id === id);
    },
    [nodes]
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
      return subjectsTaken.includes(node as ExtendedNode<Subject>);
    },
    [subjectsTaken]
  );

  function onNodeDoubleClicked(id: string) {
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
      setShowSequences(false);
      let newCurrentPeriod = currentPeriod;
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
    const newCompletedPeriods = completedPeriods ?? [];
    newCompletedPeriods.push(oldCurrentPeriod);

    if (completedPeriods.length % 2 === 0) {
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

  function resetSelectedElement() {
    setSelectedElement(undefined);
    setClusterOptions(["select a node to see cluster options"]);
    setClusterBy(undefined);
  }

  const getConnected = useCallback(
    async (id: string | string[]) => {
      if (typeof id === "string") {
        id = [id];
      }
      const response = await fetch(`/api/graph/getConnected`, {
        method: "POST",
        body: JSON.stringify({ parentNodeIds: id }),
      });
      if (!response.ok) {
        throw new Error(`Failed to get connected nodes at /api/graph/getConnected using id ${id}`);
      }
      const data = (await response.json()) as getConnectedNodesInterface;
      const newNodes = [];
      const newEdges = [];
      for (const connection of data.connections) {
        const nodeAlreadyExists = nodes.find((node) => node.id == connection.connectedNode.id);
        const edgeAlreadyExists = edges.find((edge) => {
          return (
            edge.id ==
            connection.relation.id + ":" + connection.relation.source + connection.connectedNode.id
          );
        });
        if (!nodeAlreadyExists) {
          const newNode = connection.connectedNode;
          newNode.id = connection.connectedNode.id;
          newNodes.push(newNode);
        }
        if (!edgeAlreadyExists) {
          const newEdge: GraphEdge = {
            id:
              connection.relation.id +
              ":" +
              connection.relation.source +
              connection.connectedNode.id,
            source: connection.relation.source,
            target: connection.connectedNode.id,
            label: connection.relation.label,
          };
          newEdges.push(newEdge);
        }
      }

      setAddedNodes(newNodes);
      return { newNodes: newNodes, newEdges: newEdges };
    },
    [edges, nodes]
  );

  const addConnected = useCallback(
    async (params: {
      id?: string;
      manualAdd?: { newNodes: ExtendedNode<Generic>[]; newEdges: GraphEdge[] };
    }) => {
      let newNodes;
      let newEdges;
      if (params.id) {
        let oldNodes = nodes;
        let oldEdges = edges;
        let result;
        switch (getNodeFromId(params.id)?.data.type) {
          case "Program":
            result = chooseNode(params.id, "Program", { oldNodes, oldEdges });
            break;
          case "Major":
            result = chooseNode(params.id, "Major", { oldNodes, oldEdges });
            break;
          case "Minor":
            result = chooseNode(params.id, "Minor", { oldNodes, oldEdges });
            break;
        }
        if (result) {
          oldNodes = result.oldNodes;
          oldEdges = result.oldEdges;
        }
        const connected = await getConnected(params.id);

        newNodes = [...oldNodes, ...connected.newNodes];
        newEdges = [...oldEdges, ...connected.newEdges];
      } else if (params.manualAdd) {
        newNodes = [...nodes, ...params.manualAdd.newNodes];
        newEdges = [...edges, ...params.manualAdd.newEdges];
      } else {
        throw new Error("Unreachable code reached!?!? PANIC!!!!");
      }

      const nmap = new Map(newNodes.map((n) => [n.id, n]));
      setNodeMap(nmap);

      const adjacency = new Map<string, string[]>();
      newEdges.forEach((e) => {
        if (!adjacency.has(e.source)) {
          adjacency.set(e.source, []);
        }
        adjacency.get(e.source)?.push(e.target);
      });
      setAdjacencyList(adjacency);
      setNodes(newNodes);
      setEdges(newEdges);
    },
    [edges, getConnected, getNodeFromId, nodes]
  );

  const expandConnected = useCallback(
    async (nodesToExpand: ExtendedNode<Generic>[]) => {
      const connectionsToAdd: {
        newNodes: ExtendedNode<Generic>[];
        newEdges: GraphEdge[];
      } = { newNodes: [], newEdges: [] };
      const idsToAdd = nodesToExpand.map((n) => n.id);
      const connections = await getConnected(idsToAdd);
      connectionsToAdd.newNodes.push(...connections.newNodes);
      connectionsToAdd.newEdges.push(...connections.newEdges);

      await addConnected({ manualAdd: connectionsToAdd });
    },
    [addConnected, getConnected]
  );

  const nodesFilteredByProgramAndSequence = useMemo(
    () =>
      nodes.filter((n) => {
        if (!isSubjectNode(n)) return true;
        return filterSubjectsNotInSequence(
          n,
          selectedProgram!.data.programName,
          selectedProgramSequence ?? ""
        );
      }),
    [nodes, selectedProgram, selectedProgramSequence]
  );
  // filter out prerequisites we know are not part of course
  const nodesFilteredByProgram = useMemo(
    () =>
      nodes.filter((n) => {
        if (!isPrerequisiteNode(n)) return true;
        return filterPrerequisitesNotInCourse(n, selectedProgram!.data.programName);
      }),
    [nodes, selectedProgram]
  );

  const nodesFilteredByPotentialElec = useMemo(
    () =>
      nodes.filter((n) => {
        if (!isSubjectNode(n) || !n.fill) return true;
        return (
          isRequiredByProgramOrSpecialisation(n, nodes, adjacencyList, nodeMap, edges) !==
          RequiredType.NOT_REQUIRED
        );
      }),
    [adjacencyList, edges, nodeMap, nodes]
  );

  const nodesFilteredBySubject = useMemo(
    () =>
      nodes.filter((n) => {
        if (!isPrerequisiteNode(n)) return true;
        const subjectNodes = nodes.filter((nn) => isSubjectNode(nn));
        return filterImpossiblePrerequisites(n, subjectNodes);
      }),
    [nodes]
  );

  // filter out edges that are no longer visible
  const nodesFilteredByEdges = useMemo(
    () => edges.filter((e) => filterDisconnectedEdges(e, nodes)),
    [edges, nodes]
  );
  const nodesFilteredByEdgesAndPre = useMemo(
    () =>
      edges.filter((e) => {
        return !(
          e.label === "PREREQUISITE_FOR" && !isPrerequisiteNode(fromNodesById(e.target, nodes))
        );
      }),
    [edges, nodes]
  );

  const nodesFilteredBySubjectAndPre = useMemo(
    () =>
      nodes.filter((n) => {
        if (!isSubjectNode(n)) return true;
        return !(
          n.data.prerequisites.length > 3 &&
          getParentsByType<Prerequisite>(n, nodes, adjacencyList, nodeMap, "Prerequisites").filter(
            (p) => p.data.forSubject === n.data.code
          ).length < 1
        );
      }),
    [adjacencyList, nodeMap, nodes]
  );

  // filter out prerequisite nodes that do not lead to a visible subject
  const nodesFilteredByPrereq = useMemo(
    () =>
      nodes.filter((n) => {
        if (!isPrerequisiteNode(n)) return true;
        return filterLeafPrerequisites(n, edges);
      }),
    [edges, nodes]
  );

  useEffect(() => {
    let newNodes = nodes;
    let newEdges = edges;

    if (selectedProgram && selectedProgram.data.programSequences && selectedProgramSequence) {
      if (selectedProgram) newNodes = nodesFilteredByProgramAndSequence;
    }

    if (selectedProgram) newNodes = nodesFilteredByProgram;

    if (!showPotentialElectives) {
      newNodes = nodesFilteredByPotentialElec;
    }

    newNodes = nodesFilteredBySubject;
    newEdges = nodesFilteredByEdges;
    newEdges = nodesFilteredByEdgesAndPre;
    newNodes = nodesFilteredBySubjectAndPre;
    newNodes = nodesFilteredByPrereq;
    /**
     * Graph Semantic Highlighting Pass
     */
    newNodes.forEach((n) => {
      if (!isSubjectNode(n)) return;
      const parentPrerequisites = getParentsByType<Prerequisite>(
        n,
        newNodes,
        adjacencyList,
        nodeMap,
        "Prerequisites"
      ).filter((p) => p.data.forSubject === n.data.code);
      if (
        isEligibleForSubject(parentPrerequisites, getCompletedSubjects()) &&
        isOfferedInCurrentPeriod(n) !== OfferStatus.NO
      ) {
        n.fill = nodeFillMap["Subject"];
      } else {
        if (!hasTaken(n)) n.fill = colours.inaccessible;
      }
    });

    newNodes.forEach((n) => {
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

    newNodes.forEach((n) => {
      if (!isSubjectNode(n) || !n.fill) return;
      if (!hasTaken(n)) {
        if (n.fill !== colours.inaccessible) n.fill = new HEXGBA(n.fill).multiply(0.75).toHex();
      }
    });

    newNodes.forEach((n) => {
      if (!isPrerequisiteNode(n)) return;
      if (prerequisiteIsFulfilled(n, getCompletedSubjects())) {
        n.fill = nodeFillMap["Prerequisites"];
      } else {
        n.fill = colours.inaccessible;
      }
    });

    setDisplayedNodes(newNodes);
    setDisplayedEdges(newEdges);
  }, [
    nodes,
    selectedProgramSequence,
    selectedProgram,
    showPotentialElectives,
    completedPeriods.length,
    currentPeriod.subjectsTaken.length,
    updateToggle,
    edges,
    nodesFilteredByProgram,
    nodesFilteredBySubject,
    nodesFilteredByEdges,
    nodesFilteredByEdgesAndPre,
    nodesFilteredBySubjectAndPre,
    nodesFilteredByPrereq,
    nodesFilteredByProgramAndSequence,
    nodesFilteredByPotentialElec,
    adjacencyList,
    nodeMap,
    getCompletedSubjects,
    isOfferedInCurrentPeriod,
    hasTaken,
  ]);

  useEffect(() => {
    if (addedNodes.length > 0) expandConnected(addedNodes);
  }, [addedNodes, expandConnected]);

  return (
    <main className={`h-[100vh] flex flex-col ${showLineup ? "p-2" : "pb-2 px-2"}`}>
      <HelpWindow
        showHelp={showHelp}
        firstShowHelp={firstShowHelp}
        onSetShowHelp={setShowHelp}
        onSetFirstShowHelp={setFirstShowHelp}
      />
      <NodeReferrence
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
