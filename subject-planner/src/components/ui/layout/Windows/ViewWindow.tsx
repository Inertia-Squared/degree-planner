import { displayMode } from "@/utils/consts";
import React from "react";
import { HeaderItem, shouldShowItem } from "@/components/ui/layout/Containers/HeaderBar";
import { WindowContainer } from "@/components/ui/layout/Containers/WindowContainer";
import { useGraphUIStore, useGraphRenderStore } from "@/app/store/graphStore";
import {updateGraphVisualisation} from "@/app/store/graphActions";

const ViewWindow = ({ className }: { className?: string; }) => {
    // Zustand Hooks
    const selectedHeaderItem = useGraphUIStore((state) => state.selectedHeaderItem);
    const clusterOptions = useGraphRenderStore((state) => state.clusterOptions);
    const exportToCsv = useGraphRenderStore((state) => state.exportToCsv);

    const itemIdentifier = HeaderItem.VIEW;

    return (
        (shouldShowItem(selectedHeaderItem, itemIdentifier) && (
            <WindowContainer
                className={`${className}`}
                onClose={() => useGraphUIStore.setState({ selectedHeaderItem: HeaderItem.NONE })}
                title={'View Settings'}
                childElement={
                    <div className="flex">
                        <div className="flex h-fit">
                            <div className={`mx-2 hidden md:block`}></div>
                            <div className={`flex-3 flex`}>
                                <div className={"flex flex-col space-y-4"}>
                                    <div>
                                        <h2 className={`font-bold`}>Filters</h2>
                                        <div className={`space-y-3`}>
                                            <div>
                                                {displayMode === "forceDirected2d" && (
                                                    <div className="flex flex-row items-center content-center space-x-2">
                                                        <label className={`flex`}>Cluster Nodes By: </label>
                                                        <select
                                                            className="form-row w-fit"
                                                            onChange={(s) => useGraphRenderStore.setState({ clusterBy: s.currentTarget.value })}
                                                        >
                                                            {clusterOptions.map((c) => {
                                                                return (
                                                                    <option key={c} value={c}>
                                                                        {c.charAt(0).toUpperCase() + c.slice(1)}
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
                                                        useGraphRenderStore.setState({ showPotentialElectives: e.target.checked });
                                                        updateGraphVisualisation();
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-gray-200">
                                        <button
                                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                            onClick={() => exportToCsv()}
                                        >
                                            Export to CSV
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

export default ViewWindow;
