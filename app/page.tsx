import { requireChatGPTUser,chatGPTSignOutPath } from "./chatgpt-auth";
import { CurrentUserProvider } from "@/lib/auth/CurrentUserContext";
import { GrantsWorkspace } from "@/components/grants/GrantsWorkspace";
import { sprintServiceUrl } from "@/lib/server/config";
export default async function Home(){
 const user=await requireChatGPTUser("/");
 return <CurrentUserProvider user={{id:user.userId,displayName:user.displayName}}><div className="service-shell"><nav className="service-top"><a href="/" className="service-brand"><span>G</span>Grant Project</a><span className="service-section">Discover grants and prepare applications</span><a className="service-session" href={chatGPTSignOutPath()}>Sign out</a></nav><main><GrantsWorkspace sprintUrl={sprintServiceUrl()}/></main></div></CurrentUserProvider>;
}
