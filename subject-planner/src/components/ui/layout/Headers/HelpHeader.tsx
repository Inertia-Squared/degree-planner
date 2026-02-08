import {HeaderItem, HeaderItemProps, shouldShowItem} from "@/components/ui/layout/Containers/HeaderBar";

const TimelineHeader = ({onHeaderClicked, selectedHeaderItem,}: HeaderItemProps) => {
    const itemIdentifier = HeaderItem.HELP;
    return (
            <div
                    onClick={() => onHeaderClicked(itemIdentifier)}
                    className="header-button"
            >
                <span className={`${shouldShowItem(selectedHeaderItem, itemIdentifier) && "header-button-selected"}`}>Help</span>
            </div>
    );
};

export default TimelineHeader;
