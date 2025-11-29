import { getConnectedNodesInterface } from "@/app/api/graph/getConnected/route";
import { ExtendedNode, Generic } from "@/utils/types";
import { Dispatch, SetStateAction, useCallback } from "react";
import { GraphEdge } from "reagraph";
import {chooseNode} from "@/lib/graph/graphUtil";



export function useGraphConnection({
  nodes,
  edges,
  setNodes,
  setEdges,
  setNodeMap,
  setAdjacencyList,
  setAddedNodes,
  getNodeFromId,
}: {
  nodes: ExtendedNode<Generic>[];
  edges: GraphEdge[];
  setNodes: Dispatch<SetStateAction<ExtendedNode<Generic>[]>>;
  setEdges: (value: SetStateAction<GraphEdge[]>) => void;
  setNodeMap: Dispatch<SetStateAction<Map<string, ExtendedNode<Generic>>>>;
  setAdjacencyList: Dispatch<SetStateAction<Map<string, string[]>>>;
  setAddedNodes: Dispatch<SetStateAction<ExtendedNode<Generic>[]>>;
  getNodeFromId: (id: string) => ExtendedNode<Generic> | undefined;
}) {
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
      return { newNodes, newEdges };
    },
    [edges, nodes, setAddedNodes]
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
    [edges, getConnected, getNodeFromId, nodes, setAdjacencyList, setEdges, setNodeMap, setNodes]
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

  return {
    expandConnected
  }
}
