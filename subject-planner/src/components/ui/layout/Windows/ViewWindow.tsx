import {displayMode} from "@/utils/consts";
import React, {Dispatch, SetStateAction} from "react";
import {HeaderItem, shouldShowItem} from "@/components/ui/layout/Containers/HeaderBar";
import {WindowContainer} from "@/components/ui/layout/Containers/WindowContainer";

// todo move non-search related features out into their own header item/menu
const ViewWindow = ({
    className,
    selectedHeaderItem,
    setSelectedHeaderItem,
    setClusterBy,
    clusterOptions,
    setShowPotentialElectives,
}: {
    className: string;
    selectedHeaderItem: HeaderItem;
    setSelectedHeaderItem: Dispatch<SetStateAction<HeaderItem>>;
    setClusterBy: Dispatch<SetStateAction<string | undefined>>;
    clusterOptions: string[];
    setShowPotentialElectives: Dispatch<SetStateAction<boolean>>;
}) => {
    const itemIdentifier = HeaderItem.VIEW;
    return (
            (shouldShowItem(selectedHeaderItem, itemIdentifier) &&
                    <WindowContainer className={`${className}`}
                     onClose={() => setSelectedHeaderItem(HeaderItem.NONE)} title={'View Settings'}
                     childElement={
                         <div className="flex">
                             {/* Pretty much everything below here needs to go in its own component */}
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
                                                                         onChange={(s) => setClusterBy(s.currentTarget.value)}
                                                                 >
                                                                     {clusterOptions.map((c) => {
                                                                         return (
                                                                                 <option key={c}
                                                                                         value={c}>
                                                                                     {c.charAt(0).toUpperCase() + c.slice(1)}
                                                                                 </option>
                                                                         );
                                                                     })}
                                                                 </select>
                                                             </div>
                                                     )}
                                                 </div>
                                                 <div className="flex space-x-2">
                                                     <label>Show Potentially Relevant
                                                         Electives: </label>
                                                     <input
                                                             type={"checkbox"}
                                                             onChange={(e) => {
                                                                 setShowPotentialElectives(e.target.checked);
                                                             }}
                                                     />
                                                 </div>
                                             </div>
                                         </div>
                                     </div>
                                     <div className={`grow`}></div>
                                 </div>
                             </div>
                         </div>}
                    />)
    );
};

export default ViewWindow;
