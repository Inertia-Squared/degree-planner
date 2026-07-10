import React from "react";
import { HeaderItemType } from "@/components/ui/layout/Containers/HeaderBar";
import { WindowContainer } from "@/components/ui/layout/Containers/WindowContainer";
import { useGraphUIStore} from "@/app/store/graphStore";
import {exportToJSON} from "@/app/store/graphActions";
import {solveDegree} from "@/app/store/degreeActions";

const GenerateWindow = ({ className }: { className?: string; }) => {
    const selectedHeaderItem = useGraphUIStore((state) => state.selectedHeaderItem);
    const itemIdentifier = HeaderItemType.GENERATE;

    return (
            (selectedHeaderItem === itemIdentifier && (
                    <WindowContainer
                            className={`${className}`}
                            onClose={() => useGraphUIStore.setState({ selectedHeaderItem: HeaderItemType.NONE })}
                            title={'Generate Degree Plan'}
                            childElement={
                                <div className="flex">
                                    <div className="flex h-fit">
                                        <div className={`mx-2 hidden md:block`}></div>
                                        <div className={`flex-3 flex`}>
                                            <div className={"flex flex-col space-y-4"}>
                                                <div className="pt-4 border-t border-gray-200">
                                                    <button
                                                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                            onClick={() => exportToJSON()}
                                                    >
                                                        Export to JSON
                                                    </button>
                                                    <button
                                                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                                            onClick={() => solveDegree()}
                                                    >
                                                        Auto-Solve Degree
                                                    </button>
                                                </div>
                                            </div>
                                            <div className={`grow`}></div>
                                        </div>
                                    </div>
                                </div>
                            }
                    />
            ))
    );
};

export default GenerateWindow;
