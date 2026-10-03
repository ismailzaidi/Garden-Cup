import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import App from "../src/App.jsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function addPlayer(name) {
  const input = screen.getByPlaceholderText("Player name");
  fireEvent.change(input, { target: { value: name } });
  fireEvent.keyDown(input, { key: "Enter" });
}

function clickText(text) {
  fireEvent.click(screen.getByText(text));
}

describe("New / reset", () => {
  it("keeps the player roster but clears fixtures and the mode badge", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    clickText("1"); // legs per pairing
    clickText("GENERATE FIXTURES");
    await screen.findByText(/Fixtures/);

    clickText("New");

    // roster survives
    expect(screen.getByText("Players (2)")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    // fixtures did not survive — back to a fresh "generate", not "regenerate",
    // and the header's active-mode pill (only rendered while matches.length
    // > 0) is gone, leaving just the mode picker button in Setup
    expect(screen.getByText("GENERATE FIXTURES")).toBeInTheDocument();
    expect(screen.getAllByText("League + Final")).toHaveLength(1);
  });

  it("re-persists the kept roster (not just an in-memory reset) so a reload after New doesn't lose it", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    clickText("1");
    clickText("GENERATE FIXTURES");
    await screen.findByText(/Fixtures/);

    clickText("New");

    // the debounced persist effect in useTournament.js writes ~1.5s after
    // any state change; give it real time to land, then read localStorage
    // the same way a reload would
    await new Promise((resolve) => setTimeout(resolve, 1700));
    const saved = JSON.parse(localStorage.getItem("gardenCup:current"));
    expect(saved.players.map((p) => p.name)).toEqual(["Alice", "Bob"]);
    expect(saved.matches).toEqual([]);
  }, 4000);
});
