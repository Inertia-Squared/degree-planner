import { displayMode } from "@/utils/consts";
import { ExtendedNode, Major, Minor, Program, StudyPeriod, StudyPeriodItem } from "@/utils/types";
import React, { Dispatch, SetStateAction } from "react";
import LineupSelector from "../LineupSelector";

const ProgramWindow = ({
  searchProgram,
  forceAddSpecialisation,
  startExploring,
  showLineup,
  setClusterBy,
  clusterOptions,
  setShowPotentialElectives,
  showSequences,
  setSelectedProgramSequence,
  setStartPeriod,
  setCurrentPeriod,
  selectedProgram,
  completedPeriods,
  currentPeriod,
}: {
  searchProgram: (searchString: string) => Promise<void>;
  forceAddSpecialisation: (node: ExtendedNode<Major | Minor>) => void;
  startExploring: () => void;
  showLineup: boolean;
  setClusterBy: Dispatch<SetStateAction<string | undefined>>;
  clusterOptions: string[];
  setShowPotentialElectives: Dispatch<SetStateAction<boolean>>;
  showSequences: boolean;
  setSelectedProgramSequence: Dispatch<SetStateAction<string | undefined>>;
  setStartPeriod: Dispatch<SetStateAction<StudyPeriod>>;
  setCurrentPeriod: Dispatch<SetStateAction<StudyPeriodItem>>;
  selectedProgram: ExtendedNode<Program> | undefined;
  completedPeriods: StudyPeriodItem[];
  currentPeriod: StudyPeriodItem;
}) => {
  return (
    <div
      className={`border-2 p-1 flex flex-col md:flex-row overflow-x-scroll w-fit max-w-full h-fit relative z-20 bg-white ${
        showLineup ? "block" : "hidden"
      }`}
    >
      <div className={`flex-2`}>
        <h1>Please Search for a Program to Begin.</h1>
        <hr />
        <LineupSelector
          onSearchEvent={searchProgram}
          onMajorEvent={forceAddSpecialisation}
          onMinorEvent={forceAddSpecialisation}
          onStartExploring={startExploring}
          className={`p-1`}
        />
      </div>
      {selectedProgram && (
        <div className={`flex-3 flex`}>
          <div className={`border-r-2 mx-2 hidden md:block`}></div>
          <div className={`flex-3 flex`}>
            <div className={"flex flex-col"}>
              <h2 className={`font-bold`}>Graph Analysis</h2>
              <hr className={`max-w-[95%] md:max-w-full`} />
              <div>
                {displayMode === "forceDirected2d" && (
                  <div>
                    <label>Cluster Nodes By: </label>
                    <select onChange={(s) => setClusterBy(s.currentTarget.value)}>
                      {clusterOptions.map((c) => {
                        return (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
              <h2 className={`font-bold`}>Program Filters</h2>
              <hr className={`max-w-[95%] md:max-w-full`} />
              <div>
                <label>Show Potentially Relevant Electives: </label>
                <input
                  type={"checkbox"}
                  onChange={(e) => {
                    setShowPotentialElectives(e.target.checked);
                  }}
                />
              </div>
              {showSequences && (
                <div>
                  <label>Selected Study Sequence: </label>
                  <select
                    className={`max-w-[95%]`}
                    onChange={(s) => {
                      const sequence = s.currentTarget.value;
                      setSelectedProgramSequence(sequence);
                      let newStartPeriod: StudyPeriod = "autumn";
                      if (sequence.includes("mid-")) {
                        newStartPeriod = "spring";
                      }
                      setStartPeriod(newStartPeriod);
                      if (!completedPeriods || completedPeriods.length < 1) {
                        const newStudyPeriod: StudyPeriodItem = currentPeriod;
                        newStudyPeriod.period = newStartPeriod;
                        setCurrentPeriod(newStudyPeriod);
                      }
                    }}
                  >
                    {selectedProgram == undefined ? (
                      <p>Program not found</p>
                    ) : (
                      selectedProgram.data["programSequences"].map((s) => {
                        return (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>
              )}
            </div>
            <div className={`grow`}></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramWindow;
