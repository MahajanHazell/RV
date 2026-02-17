/*
 * Main App Component
 *
 * Root component of the React application
 * Orchestrates main application layout
 */

import { useState } from "react";
import TicketRedeem from "./components/TicketRedeem";
import Chat from "./components/Chat";

export default function App() {
  const [museumId, setMuseumId] = useState<string | null>(null);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-title">Exhibit AI</div>
          <div className="topbar-sub">Ask questions. Get cited answers.</div>
        </div>
      </header>

      <main className="container">
        {!museumId ? (
          <TicketRedeem onSuccess={setMuseumId} />
        ) : (
          <Chat museumId={museumId} />
        )}
      </main>

      <footer className="footer">Museum Guide • Verified answers with sources</footer>
    </div>
  );
}
