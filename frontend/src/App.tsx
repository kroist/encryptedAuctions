import { Routes, Route } from "react-router-dom";
import { Providers } from "./Providers";
import { HomePage } from "./pages/HomePage";
import { ItemPage } from "./pages/ItemPage";
import { CreateAuctionPage } from "./pages/CreateAuctionPage";
import "./App.css";
import "./styles/forms.css";

function App() {
  return (
    <Providers>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/item/:address" element={<ItemPage />} />
          <Route path="/create-auction" element={<CreateAuctionPage />} />
        </Routes>
      </div>
    </Providers>
  );
}

export default App;
