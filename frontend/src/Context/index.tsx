import type {
  Dispatch,
  ReactNode} from "react";
import {
  createContext,
  useContext,
  useReducer
} from "react";

export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  is_demo: boolean;
};

interface AppState {
  isSessionLoading: boolean;
  authUser: AuthUser | null;
  googleClientId: string | null;
  linkToken: string | null;
}

const initialState: AppState = {
  isSessionLoading: true,
  authUser: null,
  googleClientId: null,
  linkToken: "", // Don't set to null or error message will show up briefly when site loads
};

export type AppAction =
  | {
      type: "SESSION_LOADED";
      authUser: AuthUser | null;
      googleClientId: string | null;
    }
  | {
      type: "AUTHENTICATED";
      authUser: AuthUser;
    }
  | {
      type: "AUTH_EXPIRED";
    }
  | {
      type: "SET_LINK_TOKEN";
      linkToken: string | null;
    };

interface AppContext extends AppState {
  dispatch: Dispatch<AppAction>;
}

const Context = createContext<AppContext | null>(null);

export const useAppContext = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }

  return context;
};

const { Provider } = Context;
export const AppProvider: React.FC<{ children: ReactNode }> = (
  props
) => {
  const reducer = (
    state: AppState,
    action: AppAction
  ): AppState => {
    switch (action.type) {
      case "SESSION_LOADED":
        return {
          ...state,
          authUser: action.authUser,
          googleClientId: action.googleClientId,
          isSessionLoading: false,
        };
      case "AUTHENTICATED":
        return {
          ...state,
          authUser: action.authUser,
          isSessionLoading: false,
        };
      case "AUTH_EXPIRED":
        return {
          ...state,
          authUser: null,
          linkToken: "",
          isSessionLoading: false,
        };
      case "SET_LINK_TOKEN":
        return { ...state, linkToken: action.linkToken };
      default:
        return { ...state };
    }
  };
  const [state, dispatch] = useReducer(reducer, initialState);
  return <Provider value={{ ...state, dispatch }}>{props.children}</Provider>;
};

export default Context;
