import { displayMode } from "@/utils/consts";
import { ExtendedNode, Major, Minor, Program, StudyPeriod, StudyPeriodItem } from "@/utils/types";
import React, { Dispatch, SetStateAction } from "react";
import LineupSelector from "../LineupSelector";
import { RxCross1 } from "react-icons/rx";

const ProgramWindow = ({
    searchProgram,
    forceAddSpecialisation,
    startExploring,
    showLineup,
    setShowLineup,
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
    setShowLineup: (value: SetStateAction<boolean>) => void;
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
            className={`container mx-auto shadow-lg flex flex-col overflow-x-scroll w-fit p-4 max-w-full h-fit relative z-20 bg-white ${
                showLineup ? "block" : "hidden"
            }`}
        >
            <div className="flex items-center justify-between py-4">
                <h1>Please Search for a Program to Begin</h1>
                <RxCross1 className="cursor-pointe" onClick={() => setShowLineup(false)} />
            </div>
            <div className="flex">
                <div>
                    <LineupSelector
                        onSearchEvent={searchProgram}
                        onMajorEvent={forceAddSpecialisation}
                        onMinorEvent={forceAddSpecialisation}
                        onStartExploring={startExploring}
                    />
                </div>
                {selectedProgram && (
                    <div className="flex h-fit">
                        <div className={`mx-2 hidden md:block`}></div>
                        <div className={`flex-3 flex`}>
                            <div className={"flex flex-col"}>
                                <h2 className={`font-bold`}>Filters</h2>
                                <div>
                                    {displayMode === "forceDirected2d" && (
                                        <div className="flex flex-col">
                                            <label>Cluster Nodes By: </label>
                                            <select
                                                className="form-row"
                                                onChange={(s) => setClusterBy(s.currentTarget.value)}
                                            >
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
                                <div className="flex space-x-2">
                                    <label>Show Potentially Relevant Electives: </label>
                                    <input
                                        type={"checkbox"}
                                        onChange={(e) => {
                                            setShowPotentialElectives(e.target.checked);
                                        }}
                                    />
                                </div>
                                {showSequences && (
                                    <div className="flex flex-col">
                                        <label>Selected Study Sequence: </label>
                                        <select
                                            className="form-row"
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
        </div>
    );
};

export default ProgramWindow;
