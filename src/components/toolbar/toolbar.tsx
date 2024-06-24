import UserToolbarBttn from "./userToolbarBttn";
import Logo from "./logo";

export default function Toolbar() {
  return (
    <div className="flex items-center justify-between gap-4 bg-slate-800 px-4  text-white">
      <Logo />
      <UserToolbarBttn />
    </div>
  );
}
