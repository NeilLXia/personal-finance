import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { AppProvider } from "./Context";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <AppProvider>
    <App />
  </AppProvider>
);
