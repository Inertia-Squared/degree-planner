import { getProgramsInterface } from "@/app/api/graph/getPrograms/route";
import { ExtendedNode, Generic, Program } from "@/utils/types";
import { Dispatch, SetStateAction } from "react";

export function useProgram({
    setSelectedProgram,
    setSelectedProgramSequence,
}: {
    nodes: ExtendedNode<Generic>[]
    setNodes: Dispatch<SetStateAction<ExtendedNode<Generic>[]>>
    setSelectedProgram: Dispatch<SetStateAction<ExtendedNode<Program> | undefined>>
    setSelectedProgramSequence: Dispatch<SetStateAction<string | undefined>>
    setNodesHot: Dispatch<SetStateAction<boolean>>
}) {
      const searchProgram = async (searchString: string) => {

      };
    
      return {
        searchProgram
      }
}