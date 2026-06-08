import React, {useEffect, useState} from "react";
import Link from "next/link";
import Hamburger from "../../HamburgerButton";
import { useGraphDataStore } from "@/app/store/graphStore";
import {CustomEvents} from "@/utils/consts";
import HeaderItem from "@/components/ui/layout/Containers/HeaderItem";
import {FiSearch} from "react-icons/fi";
import {MdGridView} from "react-icons/md";
import {RiTimeLine} from "react-icons/ri";
import {TbHelpHexagon} from "react-icons/tb";

export enum HeaderItemType {
    NONE="NONE",
    SEARCH="SEARCH",
    HELP="HELP",
    TIMELINE="TIMELINE",
    VIEW="VIEW",
}

export enum HeaderShowCondition {
    ALL,
    NOT_EXPLORING_GRAPH,
    EXPLORING_GRAPH,
}

export interface HeaderItemProps {
    itemIdentifier: HeaderItemType;
    headerIcon: React.ReactNode;
    showMode?: HeaderShowCondition;
    animateCondition?: boolean;
}

const HeaderBar = () => {
    const [isOpen, setIsOpen] = useState(false);

    function clickHandler() {
        setIsOpen((value) => !value);
    }

    useEffect(() => {
        const onCloseBurger = () => {
            setIsOpen(false);
        }
        addEventListener(CustomEvents.closeBurger.type, () => onCloseBurger());

        return () => {
            removeEventListener(CustomEvents.closeBurger.type, () => onCloseBurger());
        }
    })

    const {exploringStarted} = useGraphDataStore.getState();

    const SearchHeader: HeaderItemProps = {
        itemIdentifier: HeaderItemType.SEARCH,
        headerIcon: <FiSearch/>,
        showMode: HeaderShowCondition.NOT_EXPLORING_GRAPH,
        animateCondition: !exploringStarted
    }

    const ViewHeader: HeaderItemProps = {
        itemIdentifier: HeaderItemType.VIEW,
        headerIcon: <MdGridView/>,
        showMode: HeaderShowCondition.EXPLORING_GRAPH
    }

    const TimeLineHeader: HeaderItemProps = {
        itemIdentifier: HeaderItemType.TIMELINE,
        headerIcon: <RiTimeLine/>
    }

    const HelpHeader: HeaderItemProps = {
        itemIdentifier: HeaderItemType.HELP,
        headerIcon: <TbHelpHexagon/>,
    }

    const HeaderItems = [
            SearchHeader,
            ViewHeader,
            TimeLineHeader,
            HelpHeader,
    ]

    function renderHeaderItems(){
        return HeaderItems.map(item=><HeaderItem key={item.itemIdentifier} {...item}/>)
    }

    return (
        <div className="h-16 w-screen fixed top-0 z-30 shadow-md backdrop-blur-md">
            <div className="container mx-auto h-full flex items-center justify-between px-4">
                <div className="font-extrabold text-2xl">
                    <Link href={"/subject-planner/public"}>
                        MyDegree<span className="text-[#7CB342]">.Help</span>
                    </Link>
                </div>
                <div className="hidden h-full md:flex items-center space-x-8">
                    {renderHeaderItems()}
                </div>
                <div className="md:hidden">
                    <Hamburger isOpen={isOpen} clickHandler={clickHandler} />
                    {isOpen && (
                        <div className="absolute flex flex-col space-y-6 right-0 bg-white w-fit p-6 rounded-l-lg z-32 shadow-xl">
                            {renderHeaderItems()}
                        </div>
                    )}
                </div>
            </div> 
        </div>
    );
};

export default HeaderBar;