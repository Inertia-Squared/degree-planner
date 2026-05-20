"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import InfoWindow from "@/components/ui/layout/Windows/InfoWindow";
import { TimelineWindow } from "@/components/ui/layout/Windows/TimelineWindow";
import { displayMode } from "@/utils/consts";
import ViewWindow from "@/components/ui/layout/Windows/ViewWindow";
import HeaderBar, { HeaderItem } from "@/components/ui/layout/Containers/HeaderBar";
import ShowIneligible from "@/components/ShowIneligible";
import SearchWindow from "@/components/ui/layout/Windows/SearchWindow";
import HelpWindow from "@/components/ui/layout/Windows/HelpWindow";
import {
    useGraphDataStore,
    useGraphRenderStore,
    useGraphUIStore
} from "@/app/store/graphStore";
import {updateGraphVisualisation} from "@/app/store/graphActions";

const ForceGraph = dynamic(() => import("../components/ForceGraph"), {
    ssr: false,
});

export default function Home() {
    const selectedHeaderItem = useGraphUIStore((state) => state.selectedHeaderItem);

    function onCanvasClicked() {
        const { selectedHeaderItem } = useGraphUIStore.getState();
        if (selectedHeaderItem !== HeaderItem.NONE) {
            useGraphUIStore.setState({ selectedHeaderItem: HeaderItem.NONE });
        } else {
            resetSelectedElement();
        }
    }

    function resetSelectedElement() {
        useGraphRenderStore.setState({
            clusterOptions: ["Select a node to see cluster options"],
            clusterBy: undefined,
            selectedElement: undefined,
        });
        useGraphUIStore.setState({ showInfo: false });
    }

    function onToggleShowIneligible(shouldShow: boolean) {
        useGraphRenderStore.setState({ showAllIneligible: shouldShow });
        updateGraphVisualisation();
    }

    // Wrapped in useEffect to prevent memory leaks
    // https://stackoverflow.com/questions/73997221/how-does-unsubscribe-in-the-useeffect-cleanup-function-actually-work
    useEffect(() => {
        const unsubscribe = useGraphDataStore.subscribe((current, prev) => {
            if (current.nodesHot !== prev.nodesHot && current.nodesHot) {
                setTimeout(() => useGraphDataStore.setState({ nodesHot: false }), 1000);
            }
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        const unsubscribe = useGraphDataStore.subscribe((current, prev) => {
            // Automatically sync visual layer when raw nodes change, we now update it manually
            if (current.nodes !== prev.nodes || current.edges !== prev.edges) {
                updateGraphVisualisation();
            }

            if (current.nodesHot !== prev.nodesHot && current.nodesHot) {
                setTimeout(() => useGraphDataStore.setState({ nodesHot: false }), 1000);
            }
        });
        return unsubscribe;
    }, []);

    return (
        <>
            <HeaderBar />
            <main className={`h-[100vh] py-16 flex flex-col overflow-hidden ${selectedHeaderItem === HeaderItem.SEARCH ? "p-2" : "pb-2 px-2"}`}>
                <ForceGraph
                    layoutMode={displayMode}
                    clickCanvas={onCanvasClicked}
                    className={`grow w-full h-full absolute top-0 left-0 z-10`}
                />
                <ViewWindow className={`header-window-top-right z-20`} />
                <SearchWindow className={`header-window-top-right z-20`} />
                <TimelineWindow className={`header-window-top-right z-20`} />
                <InfoWindow className={`header-window header-window-top-right z-15 overflow-auto`} />
                <HelpWindow className={`header-window-top-right z-20`} />
                
                <ShowIneligible
                    className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit z-20 max-h-1/2 max-w-1/5 border-2 absolute right-1 bottom-0 my-auto`}
                    onToggle={onToggleShowIneligible}
                />
            </main>
        </>
    );
}
