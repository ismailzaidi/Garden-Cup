import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import App from "../src/App.jsx";
import { goTo } from "./helpers/renderApp.jsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

const record = (id, champion, date, extra = {}) => ({
  id, date, mode: "league", players: ["Sam", "Ali", "Mo"], champion,
  topScorer: null, totalGoals: 4,
  results: [
    { name: "Sam", played: 2, w: champion === "Sam" ? 2 : 0, d: 0, l: champion === "Sam" ? 0 : 2, gf: 3, ga: 1 },
    { name: "Ali", played: 2, w: champion === "Ali" ? 2 : 0, d: 0, l: champion === "Ali" ? 0 : 2, gf: 1, ga: 3 },
    { name: "Mo", played: 2, w: 0, d: 0, l: 2, gf: 0, ga: 0 },
  ],
  ...extra,
});

describe("Home", () => {
  it("opens on Home, with every mode and its age label, and empty results", () => {
    render(<App />);
    expect(screen.getByText("Start a new tournament")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Horror" })).toHaveTextContent("8+");
    expect(screen.getByRole("button", { name: "Start Knockout" })).toHaveTextContent("All ages");
    expect(screen.getByText(/No finished tournaments yet/)).toBeInTheDocument();
    expect(screen.getByText(/starts with your first champion/)).toBeInTheDocument();
  });

  it("starts a tournament in the tapped mode", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start Knockout" }));
    expect(screen.getByText("Game mode")).toBeInTheDocument(); // the Players tab of Play
    expect(screen.getByText("Add at least 2 players to start")).toBeInTheDocument();
    const knockout = screen.getAllByText("Knockout").find((el) => el.closest("button")?.disabled === false);
    expect(knockout.closest("button")).toHaveStyle({ backgroundColor: "#1E5631" }); // selected
  });

  it("shows recent results and the all-time leaders from History, linking to the full views", async () => {
    localStorage.setItem("gardenCup:history", JSON.stringify([
      record("h2", "Sam", "2026-10-30T10:00:00.000Z"),
      record("h1", "Ali", "2026-10-29T10:00:00.000Z"),
    ]));
    render(<App />);
    await waitFor(() => expect(screen.getAllByText("Sam").length).toBeGreaterThan(0));
    const results = screen.getByText("Recent results").closest("section");
    expect(within(results).getByText("Sam")).toBeInTheDocument();
    expect(within(results).getByText("Ali")).toBeInTheDocument();
    const rows = screen.getAllByTestId("leader").map((r) => r.textContent);
    expect(rows).toHaveLength(2); // Mo has no titles and no wins, so isn't listed
    expect(rows.some((t) => t.includes("Sam") && t.includes("1 title") && t.includes("2 wins"))).toBe(true);
    expect(rows.some((t) => t.includes("Ali") && t.includes("1 title"))).toBe(true);

    fireEvent.click(within(results).getByText("All history"));
    expect(screen.getByRole("button", { name: /History · 2/ })).toHaveStyle({ backgroundColor: "#1E5631" });
  });

  it("asks before replacing a tournament in progress, and keeps it if told no", async () => {
    render(<App />);
    goTo("Play");
    const input = screen.getByPlaceholderText(/name/i);
    for (const name of ["Sam", "Ali"]) {
      fireEvent.change(input, { target: { value: name } });
      fireEvent.keyDown(input, { key: "Enter" });
    }
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));
    goTo("Home");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Start Knockout" }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByText("Start a new tournament")).toBeInTheDocument(); // still on Home
    expect(screen.getByLabelText("tournament in progress")).toBeInTheDocument();
  });
});

describe("account tab without a backend", () => {
  it("is 'My data', with download and import but no sign-in", () => {
    render(<App />);
    goTo("My data");
    expect(screen.getByText("MY DATA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download my data/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import a file/i })).toBeInTheDocument();
    expect(screen.queryByText(/sign in/i)).toBeNull();
  });
});
