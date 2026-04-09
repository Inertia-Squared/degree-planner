import React, { useState } from "react";
import Link from "next/link";
import SearchHeader from "../Headers/SearchHeader";
import TimelineHeader from "../Headers/TimelineHeader";
import ViewHeader from "@/components/ui/layout/Headers/ViewHeader";
import HelpHeader from "@/components/ui/layout/Headers/HelpHeader";
import Hamburger from "../../HamburgerButton";
import { useGraphDataStore, useGraphUIStore } from "@/app/store/graphStore";

export enum HeaderItem {
    NONE,
    SEARCH,
    HELP,
    TIMELINE,
    VIEW,
}

export interface HeaderItemProps {
    onHeaderClicked: (selectedItem: HeaderItem) => void;
    selectedHeaderItem: HeaderItem;
}

export function shouldShowItem(selectedHeaderItem: HeaderItem, testItem: HeaderItem) {
    return selectedHeaderItem === testItem;
}

const HeaderBar = () => {
    const [isOpen, setIsOpen] = useState(false);

    const exploringStarted = useGraphDataStore((state) => state.exploringStarted);
    const selectedHeaderItem = useGraphUIStore((state) => state.selectedHeaderItem);

    function headerItemClicked(selectedItem: HeaderItem) {
        setIsOpen(false);
        if (selectedHeaderItem === selectedItem) {
            useGraphUIStore.setState({ selectedHeaderItem: HeaderItem.NONE });
        } else {
            useGraphUIStore.setState({ selectedHeaderItem: selectedItem });
        }
    }

    let openStatus: string = "";
    if (isOpen) {
        openStatus = "open";
    }

    function clickHandler() {
        setIsOpen((value) => !value);
    }

    const genericArgs = {
        selectedHeaderItem,
        onHeaderClicked: headerItemClicked,
    };

    return (
        <div className="h-16 w-screen fixed top-0 z-30 shadow-md backdrop-blur-md">
            <div className="container mx-auto h-full flex items-center justify-between px-4">
                <div className="font-extrabold text-2xl">
                    <Link href={"/subject-planner/public"}>
                        MyDegree<span className="text-[#7CB342]">.Help</span>
                    </Link>
                </div>
                <div className="hidden h-full md:flex items-center space-x-8">
                    {!exploringStarted && <SearchHeader exploringStarted={exploringStarted} {...genericArgs} />}
                    {exploringStarted && <ViewHeader {...genericArgs} />}
                    <TimelineHeader {...genericArgs} />
                    <HelpHeader {...genericArgs} />
                </div>
                <div className="md:hidden">
                    <Hamburger openStatus={openStatus} isOpen={isOpen} clickHandler={clickHandler} />

                    {isOpen && (
                        <div className="absolute flex flex-col space-y-6 right-0 bg-white w-fit p-6 rounded-l-lg z-32 shadow-xl">
                            {!exploringStarted && <SearchHeader exploringStarted={exploringStarted} {...genericArgs} />}
                            {exploringStarted && <ViewHeader {...genericArgs} />}
                            <TimelineHeader {...genericArgs} />
                            <HelpHeader {...genericArgs} />
                        </div>
                    )}
                </div>
            </div> 
        </div>
    );
};

export default HeaderBar;