import {HeaderItem, HeaderItemProps, shouldShowItem} from "@/components/ui/layout/Containers/HeaderBar";

interface SearchHeaderItemProps extends HeaderItemProps {
    exploringStarted: boolean
}

const SearchHeader = ({ onHeaderClicked, selectedHeaderItem, exploringStarted }: SearchHeaderItemProps) => {
    const itemIdentifier = HeaderItem.SEARCH;
    return (
        <div
            onClick={() => onHeaderClicked(itemIdentifier)}
            className={`header-button ${(!exploringStarted && shouldShowItem(selectedHeaderItem, itemIdentifier)) && 'border-b-2 animate-pulse border-green-500'}`}
        >
            <span className={`${selectedHeaderItem === itemIdentifier && "header-button-selected"}`}>Search</span>
        </div>
    );
};

export default SearchHeader;
