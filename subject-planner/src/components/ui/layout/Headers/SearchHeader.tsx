import { HeaderItem, HeaderItemProps, shouldShowItem } from "@/components/ui/layout/Containers/HeaderBar";
import { FiSearch } from "react-icons/fi";

interface SearchHeaderItemProps extends HeaderItemProps {
    exploringStarted: boolean;
}

const SearchHeader = ({ onHeaderClicked, selectedHeaderItem, exploringStarted }: SearchHeaderItemProps) => {
    const itemIdentifier = HeaderItem.SEARCH;
    return (
        <div
            onClick={() => onHeaderClicked(itemIdentifier)}
            className={`header-button ${!exploringStarted && shouldShowItem(selectedHeaderItem, itemIdentifier) && "border-b-2 animate-pulse border-green-500"}`}
        >
            <div
                className={`${selectedHeaderItem === itemIdentifier && "header-button-selected"} flex space-x-2 justify-start items-center`}
            >
                <FiSearch />
                <span>Search</span>
            </div>
        </div>
    );
};

export default SearchHeader;
