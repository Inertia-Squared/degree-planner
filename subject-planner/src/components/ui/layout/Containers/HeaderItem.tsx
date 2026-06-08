import {HeaderItemProps, HeaderItemType, HeaderShowCondition} from "@/components/ui/layout/Containers/HeaderBar";
import {useGraphDataStore, useGraphUIStore} from "@/app/store/graphStore";
import {CustomEvents} from "@/utils/consts";


const HeaderItem = (
        {
            itemIdentifier,
            headerIcon,
            showMode = HeaderShowCondition.ALL,
            animateCondition = undefined,
        }: HeaderItemProps) =>
{
    const {selectedHeaderItem, exploringStarted} = {...useGraphUIStore.getState(), ...useGraphDataStore.getState()};
    const rawString = itemIdentifier.toString();
    const displayString = rawString.charAt(0).toUpperCase() + rawString.toLowerCase().slice(1);

    function animateHeaderItem(){
        return `${selectedHeaderItem !== itemIdentifier && "mt-0.5 border-b-2 animate-pulse border-green-500"}`;
    }

    function onHeaderClicked(selectedItem: HeaderItemType) {
        dispatchEvent(CustomEvents.closeBurger);
        if (selectedHeaderItem === selectedItem) {
            useGraphUIStore.setState({ selectedHeaderItem: HeaderItemType.NONE });
        } else {
            useGraphUIStore.setState({ selectedHeaderItem: selectedItem });
        }
    }

    let shouldShow = false;
    switch (showMode) {
        case HeaderShowCondition.ALL:
            shouldShow = true;
            break;
        case HeaderShowCondition.EXPLORING_GRAPH:
            shouldShow = exploringStarted;
            break;
        case HeaderShowCondition.NOT_EXPLORING_GRAPH:
            shouldShow = !exploringStarted;
            break;
    }

    if (shouldShow) {
        return (
                <div
                        onClick={() => onHeaderClicked(itemIdentifier)}
                        className={`header-button ${animateCondition && animateHeaderItem()}`}
                >
                    <div className={`${selectedHeaderItem === itemIdentifier && "header-button-selected"} flex space-x-2 justify-start items-center`}>
                        {headerIcon}
                        <span>{displayString}</span>
                    </div>
                </div>
        );
    }
};


export default HeaderItem;
