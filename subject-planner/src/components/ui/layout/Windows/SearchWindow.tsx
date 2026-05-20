import React, { MouseEvent, useRef, useState } from "react";
import { getProgramNamesInterface } from "@/app/api/info/getProgramNames/route";
import { getMajorsInterface } from "@/app/api/graph/getMajors/route";
import {ExtendedNode, Major, Minor, StudyPeriod, StudyPeriodItem} from "@/utils/types";
import { getMinorsInterface } from "@/app/api/graph/getMinors/route";
import { HeaderItem, shouldShowItem } from "@/components/ui/layout/Containers/HeaderBar";
import { WindowContainer } from "@/components/ui/layout/Containers/WindowContainer";
import { useGraphDataStore, useGraphUIStore } from "@/app/store/graphStore";
import { useDegreeStore } from "@/app/store/degreeStore";
import {forceAddSpecialisation, startExploring} from "@/app/store/graphActions";
import {searchProgram} from "@/app/store/degreeActions";

interface LineupSelectorProps {
    className?: string;
}

export const defaultProgram = "Bachelor of Data Science (3769)";

const SearchWindow = ({ className }: LineupSelectorProps) => {
    const nodesHot = useGraphDataStore((state) => state.nodesHot);
    const { showSequences, selectedHeaderItem } = useGraphUIStore();
    const selectedProgram = useDegreeStore(state => state.selectedProgram);

    const [program, setProgram] = useState("");
    const [typeTimer, setTypeTimer] = useState<NodeJS.Timeout>();

    const searchBar = useRef<HTMLInputElement>(null);
    const [searchValue, setSearchValue] = useState(defaultProgram);

    const [programDropdown, setProgramDropdown] = useState<string[]>([defaultProgram]);
    const [showProgramDropdown, setShowProgramDropdown] = useState(true);

    const [majorDropdown, setMajorDropdown] = useState<getMajorsInterface>();
    const [showMajorDropDown, setShowMajorDropDown] = useState(false);
    const [majorValue, setMajorValue] = useState<ExtendedNode<Major>>();

    const [minorDropdown, setMinorDropdown] = useState<getMinorsInterface>();
    const [showMinorDropDown, setShowMinorDropDown] = useState(false);
    const [minorValue, setMinorValue] = useState<ExtendedNode<Minor>>();

    const [needsReset, setNeedsReset] = useState(false);

    const searchHandbook = (programValue: string) => {
        searchProgram(programValue);
    };

    function resetSearchTimer() {
        clearTimeout(typeTimer);
        setTypeTimer(setTimeout(() => getSearchResults(), 400));
    }

    async function getSearchResults() {
        if (!searchBar.current || searchBar.current.value.replace(/['";]/g, "") === "") return;
        const response = await fetch(`/api/info/getProgramNames?programName=${searchBar.current.value}`);
        const data = (await response.json()) as getProgramNamesInterface;
        setProgramDropdown(data);
        setProgram("");
        if (data.length > 0) setShowProgramDropdown(true);
    }

    async function getMajors(searchTerm: string) {
        const response = await fetch(`/api/graph/getMajors?programName=${searchTerm}`);
        const data = (await response.json()) as getMajorsInterface;
        setMajorDropdown(data);
        if (data.majors.length > 0) setShowMajorDropDown(true);
    }

    async function getMinors(searchTerm: string) {
        const response = await fetch(`/api/graph/getMinors?programName=${searchTerm}`);
        const data = (await response.json()) as getMinorsInterface;
        setMinorDropdown(data);
        if (data.minors.length > 0) setShowMinorDropDown(true);
    }

    async function startExploringClick(e: MouseEvent<HTMLButtonElement>) {
        if (!needsReset) {
            startExploring();
            setNeedsReset(true);
            e.preventDefault();
        } else {
            window.location.reload();
        }
    }

    const itemIdentifier = HeaderItem.SEARCH;

    return (
        shouldShowItem(selectedHeaderItem, itemIdentifier) && (
            <WindowContainer
                title={'Program Search'}
                className={className}
                onClose={() => useGraphUIStore.setState({ selectedHeaderItem: HeaderItem.NONE })}
                childElement={
                    <div className={`w-full flex flex-col min-w-[200px] space-y-2 overflow-x-scroll`}>
                        <div className="flex flex-col md:flex-row">
                            <div className="w-full flex flex-col">
                                <label className="font-bold">Search Program by Name:</label>
                                <input
                                    disabled={needsReset}
                                    className={`form-row w-full outline-none`}
                                    autoComplete={"off"}
                                    ref={searchBar}
                                    value={searchValue}
                                    onInput={(e) => {
                                        setSearchValue(e.currentTarget.value);
                                        setShowProgramDropdown(false);
                                        resetSearchTimer();
                                    }}
                                    name={"program"}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex flex-col">
                                <label htmlFor="course" className="font-bold">Program:</label>
                                <div className="px-1 form-row">
                                    {!showProgramDropdown && program}
                                    {showProgramDropdown && (
                                        <select
                                            id="course"
                                            value={program || "Please Select a Degree"}
                                            className={`flex flex-col max-h-[110px] max-w-[600px] overflow-y-scroll`}
                                            onChange={async (e) => {
                                                const stripped = e.currentTarget.value;
                                                if (stripped !== program) {
                                                    setProgram(stripped);
                                                    setSearchValue(stripped);
                                                    setShowProgramDropdown(false);
                                                    searchHandbook(stripped);
                                                    setShowMajorDropDown(true);
                                                    setMajorValue(undefined);
                                                    setMinorValue(undefined);
                                                    await getMajors(stripped);
                                                    await getMinors(stripped);
                                                }
                                                e.preventDefault();
                                            }}
                                        >
                                            <option disabled>Please Select a Degree</option>
                                            {programDropdown.map((p) => {
                                                const stripped = p.replace(/[^\W\w]/g, "");
                                                return <option key={stripped}>{stripped}</option>;
                                            })}
                                        </select>
                                    )}
                                </div>
                            </div>
                        </div>

                        {!program && <p className={`text-red-500 text-sm`}>Please select a program.</p>}

                        {majorDropdown && (showMajorDropDown || majorValue) && (
                            <div>
                                <label htmlFor="major" className="font-bold">Select a major:</label>
                                <select
                                    defaultValue={"(Optional) Select a Major"}
                                    disabled={needsReset}
                                    onChange={(e) => {
                                        const m = majorDropdown?.majors.find((md) => md.id === e.currentTarget.value);
                                        if (!m) return;
                                        setShowMajorDropDown(false);
                                        setMajorValue(m);
                                        forceAddSpecialisation(m);
                                        e.preventDefault();
                                    }}
                                    className={`form-row flex flex-col max-h-[110px] max-w-[400px] w-full overflow-y-scroll`}
                                >
                                    <option disabled>(Optional) Select a Major</option>
                                    {majorDropdown.majors.map((m) => {
                                        const stripped = m.data.majorName.replace(/[^\W\w]/g, "");
                                        return (
                                            <option className={`hover:cursor-pointer !rounded-none text-start`} key={stripped} value={m.id}>
                                                {stripped}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}

                        {minorDropdown && (showMinorDropDown || minorValue) && (
                            <div>
                                <label className="font-bold">Select a minor:</label>
                                <select
                                    disabled={needsReset}
                                    defaultValue={"(Optional) Select a Minor"}
                                    onChange={(e) => {
                                        const m = minorDropdown?.minors.find((md) => md.id === e.currentTarget.value);
                                        if (!m) return;
                                        setShowMinorDropDown(false);
                                        setMinorValue(m);
                                        forceAddSpecialisation(m);
                                        e.preventDefault();
                                    }}
                                    className={`form-row flex flex-col max-h-[110px] max-w-[400px] w-full overflow-y-scroll`}
                                >
                                    <option disabled>(Optional) Select a Minor</option>
                                    {minorDropdown.minors.map((m) => {
                                        const stripped = m.data.minorName.replace(/[^\W\w]/g, "");
                                        return (
                                            <option className={`hover:cursor-pointer !rounded-none text-start`} key={stripped} value={m.id}>
                                                {stripped}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}

                        {showSequences && selectedProgram && (
                            <div className="flex flex-col">
                                <label>Selected Study Sequence: </label>
                                <select
                                    className="form-row"
                                    onChange={(s) => {
                                        const sequence = s.currentTarget.value;
                                        useDegreeStore.setState({ selectedProgramSequence: sequence });
                                        
                                        let newStartPeriod: StudyPeriod = "autumn";
                                        if (sequence.includes("mid-")) {
                                            newStartPeriod = "spring";
                                        }
                                        useDegreeStore.setState({ startPeriod: newStartPeriod });

                                        // Access latest values instantly
                                        const { completedPeriods, currentPeriod } = useDegreeStore.getState();
                                        if (!completedPeriods || completedPeriods.length < 1) {
                                            const newStudyPeriod: StudyPeriodItem = { ...currentPeriod, period: newStartPeriod };
                                            useDegreeStore.setState({ currentPeriod: newStudyPeriod });
                                        }
                                    }}
                                >

                                    {
                                        selectedProgram.data.programSequences.map((s) => {
                                        return (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}

                        <div>
                            <button
                                disabled={program === ""}
                                className={`border-none ${program !== "" ? "bg-[#7CB342] cursor-pointer" : "bg-gray-400 cursor-not-allowed"} ${
                                    program && !needsReset ? "animate-pulse" : "animate-none"
                                }`}
                                onClick={(e) => {
                                    if (!nodesHot) startExploringClick(e);
                                    else setTimeout(() => startExploringClick(e), 500);
                                }}
                            >
                                {needsReset ? "Restart" : "Start Exploring"}
                            </button>
                            <div className={"grow"} />
                        </div>
                    </div>
                }
            />
        )
    );
};

export default SearchWindow;