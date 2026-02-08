import React, { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import SearchHeader from "../Headers/SearchHeader";
import TimelineHeader from '../Headers/TimelineHeader';
import ViewHeader from "@/components/ui/layout/Headers/ViewHeader";
import HelpHeader from "@/components/ui/layout/Headers/HelpHeader";

export enum HeaderItem {
    NONE,
    SEARCH,
    HELP,
    TIMELINE,
    VIEW
}

export interface HeaderItemProps {
    onHeaderClicked: (selectedItem: HeaderItem) => void
    selectedHeaderItem: HeaderItem
}

export function shouldShowItem(selectedHeaderItem: HeaderItem, testItem: HeaderItem){
    return selectedHeaderItem === testItem;
}

const HeaderBar = ({
    selectedHeaderItem,
    setSelectedHeaderItem,
    exploringStarted,
}: {
    selectedHeaderItem: HeaderItem,
    setSelectedHeaderItem: Dispatch<SetStateAction<HeaderItem>>,
    exploringStarted: boolean
}) => {
    function headerItemClicked(selectedItem: HeaderItem){
        if (selectedHeaderItem === selectedItem) setSelectedHeaderItem(HeaderItem.NONE);
        else setSelectedHeaderItem(selectedItem);
    }
    const genericArgs = {
        selectedHeaderItem,
        onHeaderClicked: headerItemClicked
    }

    return (
        <div className="h-16 w-screen absolute top-0 z-30 shadow-md backdrop-blur-md">
            <div className="container mx-auto h-full flex items-center justify-between px-4">
                <div className="font-extrabold text-2xl">
                    <Link href={"/subject-planner/public"}>MyDegree<span className='text-[#7CB342]'>.Help</span></Link>
                </div>
                <div className="h-full flex items-center space-x-8">
                    {!exploringStarted && <SearchHeader exploringStarted={exploringStarted} {...genericArgs}/>}
                    {exploringStarted && <ViewHeader {...genericArgs}/>}
                    <TimelineHeader {...genericArgs}/>
                    <HelpHeader {...genericArgs}/>
                </div>
            </div>
        </div>
    );
};

export default HeaderBar;
