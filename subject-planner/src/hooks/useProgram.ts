import { getProgramsInterface } from "@/app/api/graph/getPrograms/route";
import { ExtendedNode, Generic, Program } from "@/utils/types";
import { Dispatch, SetStateAction } from "react";

export function useProgram({
    nodes,
    setNodes,
    setSelectedProgram,
    setSelectedProgramSequence
}: {
    nodes: ExtendedNode<Generic>[]
    setNodes: Dispatch<SetStateAction<ExtendedNode<Generic>[]>>
    setSelectedProgram: Dispatch<SetStateAction<ExtendedNode<Program> | undefined>>
    setSelectedProgramSequence: Dispatch<SetStateAction<string | undefined>>
}) {
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
    
      return {
        searchProgram
      }
}