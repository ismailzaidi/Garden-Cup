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

  it("blocks generating fixtures once a kept roster exceeds a mode's player cap", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    addPlayer("Cara");
    clickText("1");
    clickText("GENERATE FIXTURES");
    await screen.findByText(/Fixtures/);

    clickText("New");
    clickText("Best of N"); // capped at 2 players; 3 are kept from before

    expect(screen.getByText(/This mode needs exactly 2 players — remove 1 to start/)).toBeInTheDocument();
    expect(screen.getByText("GENERATE LEGS")).toBeDisabled();
  });
});
