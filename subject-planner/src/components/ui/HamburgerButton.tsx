
const Hamburger = ({
  isOpen,
  clickHandler,
}: {
  isOpen: boolean;
  clickHandler(): void;
}) => {
  return (
    <div className="flex md:hidden items-center justify-center space-x-4">
      <div
        className={`hamburger ${isOpen && 'open'} cursor-pointer md:hidden focus:outline-none`}
        onClick={clickHandler}
      >
        <span className="hamburger-top bg-black"></span>
        <span className="hamburger-middle bg-black"></span>
        <span className="hamburger-bottom bg-black"></span>
      </div>
    </div>
  );
};

export default Hamburger;
