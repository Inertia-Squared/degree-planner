import {HeaderItem, HeaderItemProps, shouldShowItem} from "@/components/ui/layout/Containers/HeaderBar";

const TimelineHeader = ({onHeaderClicked, selectedHeaderItem,}: HeaderItemProps) => {
    const itemIdentifier = HeaderItem.TIMELINE;
    return (
        <div
            onClick={() => onHeaderClicked(itemIdentifier)}
            className="header-button"
        >
            <span className={`${shouldShowItem(selectedHeaderItem, itemIdentifier) && "header-button-selected"}`}>Timeline</span>
        </div>
    );
};

export default TimelineHeader;
