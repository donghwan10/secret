import { BrowserRouter, Route, Routes } from "react-router-dom";

import { HomePage } from "./pages/HomePage";
import { HostPage } from "./pages/HostPage";
import { JoinPage } from "./pages/JoinPage";
import { PlayerPage } from "./pages/PlayerPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<HomePage />} path="/" />
        <Route element={<JoinPage />} path="/join" />
        <Route element={<PlayerPage />} path="/p/:playerToken" />
        <Route element={<HostPage />} path="/host/:roomId" />
      </Routes>
    </BrowserRouter>
  );
}
