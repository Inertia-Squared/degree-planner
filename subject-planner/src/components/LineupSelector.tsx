import React, { MouseEvent, useRef, useState } from "react";
import { getProgramNamesInterface } from "@/app/api/info/getProgramNames/route";
import { getMajorsInterface } from "@/app/api/graph/getMajors/route";
import { ExtendedNode, Major, Minor } from "@/utils/types";
import { getMinorsInterface } from "@/app/api/graph/getMinors/route";

interface LineupSelectorProps {
    onSearchEvent: (programValue: string) => void;
    onMajorEvent: (node: ExtendedNode<Major | Minor>) => void;
    onMinorEvent: (node: ExtendedNode<Major | Minor>) => void;
    onStartExploring: () => void;
}

export const defaultProgram = "Bachelor of Data Science (3769)";

const LineupSelector = ({ onSearchEvent, onMajorEvent, onMinorEvent, onStartExploring }: LineupSelectorProps) => {
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
        onSearchEvent(programValue);
    };

    function resetSearchTimer() {
        clearTimeout(typeTimer);
        setTypeTimer(setTimeout(() => getSearchResults(), 400));
    }

    async function getSearchResults() {
        if (!searchBar.current || searchBar.current.value.replace(/['";]/g, "") === "") return;
        const response = await fetch(`/api/info/getProgramNames?programName=${searchBar.current.value}`);
        const data = (await response.json()) as getProgramNamesInterface;
        console.log(data);
        setProgramDropdown(data);
        setProgram("");
        if (data.length > 0) setShowProgramDropdown(true);
    }

    async function getMajors(searchTerm: string) {
        const response = await fetch(`/api/graph/getMajors?programName=${searchTerm}`);
        const data = (await response.json()) as getMajorsInterface;
        console.log(data);
        setMajorDropdown(data);
        if (data.majors.length > 0) setShowMajorDropDown(true);
    }
    async function getMinors(searchTerm: string) {
        const response = await fetch(`/api/graph/getMinors?programName=${searchTerm}`);
        const data = (await response.json()) as getMinorsInterface;
        console.log(data);
        setMinorDropdown(data);
        if (data.minors.length > 0) setShowMinorDropDown(true);
    }

    async function startExploring(e: MouseEvent<HTMLButtonElement>) {
        if (!needsReset) {
            onStartExploring();
            setNeedsReset(true);
            e.preventDefault();
        } else {
            window.location.reload();
        }
    }

    return (
        <div className={`w-full flex flex-col min-w-[200px] space-y-2 overflow-x-scroll`}>
            <div className="flex flex-col md:flex-row">
                <div className="w-full flex flex-col">
                    <label className="font-bold">Program:</label>
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
                    <label htmlFor="course" className="font-bold">Course:</label>
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
                                    return (
                                        <option
                                            key={stripped}
                                        >
                                            {stripped}
                                        </option>
                                    );
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
                            onMajorEvent(m);
                            e.preventDefault();
                        }}
                        className={`form-row flex flex-col max-h-[110px] max-w-[400px] w-full overflow-y-scroll`}
                    >
                        <option disabled>(Optional) Select a Major</option>
                        {majorDropdown.majors.map((m) => {
                            const stripped = m.data.majorName.replace(/[^\W\w]/g, "");
                            return (
                                <option
                                    className={`hover:cursor-pointer !rounded-none text-start`}
                                    key={stripped}
                                    value={m.id}
                                >
                                    {stripped}
                                </option>
                            );
                        })}
                    </select>
                    {/*{(!majorValue && majorDropdown.majors.length > 0) && <p className={`text-blue-500 text-sm`}>OPTIONAL: Please select a major.</p>}*/}
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
                            onMinorEvent(m);
                            e.preventDefault();
                        }}
                        className={`form-row flex flex-col max-h-[110px] max-w-[400px] w-full overflow-y-scroll`}
                    >
                        <option disabled>(Optional) Select a Minor</option>
                        {minorDropdown.minors.map((m) => {
                            const stripped = m.data.minorName.replace(/[^\W\w]/g, "");
                            return (
                                <option
                                    className={`hover:cursor-pointer !rounded-none text-start`}
                                    key={stripped}
                                    value={m.id}
                                >
                                    {stripped}
                                </option>
                            );
                        })}
                    </select>
                    {/*{(!minorValue && minorDropdown.minors.length > 0) && <p className={`text-blue-500 text-sm`}>OPTIONAL: Please select a minor.</p>}*/}
                </div>
            )}
            <div>
                <button
                    disabled={program === ""}
                    className={`border-none ${program !== "" ? "bg-[#7CB342] cursor-pointer" : "bg-gray-400 cursor-not-allowed"} ${
                        program && !needsReset ? "animate-pulse" : "animate-none"
                    }`}
                    onClick={(e) => startExploring(e)}
                >
                    {needsReset ? "Restart" : "Start Exploring"}
                </button>
                <div className={"grow"} />
            </div>
        </div>
    );
};

export default LineupSelector;
