import {HeaderItem, HeaderItemProps, shouldShowItem} from "@/components/ui/layout/Containers/HeaderBar";


const SearchHeader = ({ onHeaderClicked, selectedHeaderItem}: HeaderItemProps) => {
    const itemIdentifier = HeaderItem.VIEW;
    return (
            <div
                    onClick={() => onHeaderClicked(itemIdentifier)}
                    className={`header-button`}
            >
                <span className={`${shouldShowItem(selectedHeaderItem, itemIdentifier) && "header-button-selected"}`}>View</span>
            </div>
    );
};

export default SearchHeader;
