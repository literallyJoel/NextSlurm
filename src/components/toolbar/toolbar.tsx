
import UserToolbarBttn from "./userToolbarBttn";
import { getServerAuthSession } from "@/server/auth";
import Logo from "./logo";
export default async function Toolbar() {
  return (
    <div className="flex items-center justify-between gap-4 bg-slate-800 px-4  text-white">
      <Logo />
      <UserToolbarBttn/>
    </div>
  );
}
