"use client";
import { createContext,useContext } from "react";
const Context=createContext({id:"",displayName:""});
export function CurrentUserProvider({user,children}:{user:{id:string;displayName:string};children:React.ReactNode}){return <Context.Provider value={user}>{children}</Context.Provider>;}
export const useCurrentUser=()=>useContext(Context);
