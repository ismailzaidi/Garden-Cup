import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import App from "./App.jsx";

// No real browser is available in this environment, so these drive the app
// the same way a manual click-through would: through rendered text and
// buttons only, never by reaching into component internals. They exist to
// catch wiring mistakes across the useTournament <-> mode contract <->
// component boundary that the unit tests (which import pure functions
// directly) can't see.

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

describe("League + Final — full playthrough", () => {
  it("plays a group match, sets up the final, crowns a champion, and records history", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    clickText("1"); // legs per pairing
    clickText("GENERATE FIXTURES");

    // one group match, Alice (home) vs Bob (away)
    await screen.findByText(/Fixtures/);
    const addGoalButtons = screen.getAllByLabelText("Add goal");
    fireEvent.click(addGoalButtons[0]); // Alice scores
    fireEvent.click(addGoalButtons[0]); // Alice scores again -> 2-0
    clickText("Mark played");

    clickText("Table");
    expect(screen.getByText("Alice")).toBeInTheDocument();
    clickText("SET UP FINAL (TOP 2)");

    // final: same two players, 1 leg — wait for the final's MatchCard, not for
    // "Alice" by name, since the final standings table (also on this tab)
    // repeats the same names and makes a bare text query ambiguous.
    const finalGoalButtons = await screen.findAllByLabelText("Add goal");
    expect(finalGoalButtons).toHaveLength(2);
    fireEvent.click(finalGoalButtons[0]);
    fireEvent.click(finalGoalButtons[0]);
    clickText("Mark played");

    expect(await screen.findByText("Champion")).toBeInTheDocument();
    expect(screen.getByText(/Won the final 3–0 on points/)).toBeInTheDocument();

    clickText(/History/);
    // "League + Final" now appears twice: the hero's active-mode badge
    // (still showing, regardless of tab) and the new history card.
    expect(await screen.findAllByText("League + Final")).toHaveLength(2);
  });
});

describe("Knockout — full playthrough", () => {
  it("plays both rounds of a 4-player bracket to a champion", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    addPlayer("Cara");
    addPlayer("Dee");
    clickText("Knockout");
    clickText("GENERATE BRACKET");

    await screen.findByText(/Bracket/);
    // round 1: two matches, make the home side win both
    let addGoalButtons = screen.getAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(4); // 2 matches x 2 sides
    fireEvent.click(addGoalButtons[0]); // match 1 home scores
    fireEvent.click(addGoalButtons[2]); // match 2 home scores
    screen.getAllByText("Mark played").forEach((btn) => fireEvent.click(btn));

    clickText("ADVANCE TO NEXT ROUND");

    // round 2: the final — round 1's matches keep their goal controls
    // (scores stay editable after "played"), so the final's pair is the
    // *last* two "Add goal" buttons, not the only two.
    addGoalButtons = await screen.findAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(6); // 2 round-1 matches + 1 final, x2 sides
    fireEvent.click(addGoalButtons[4]);
    screen.getAllByText("Mark played").slice(-1).forEach((btn) => fireEvent.click(btn));

    expect(await screen.findByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("Unbeaten through the bracket")).toBeInTheDocument();

    clickText(/History/);
    expect(await screen.findAllByText("Knockout")).toHaveLength(2);
  });
});

describe("Winner Stays On — full playthrough", () => {
  it("lets the king defend a streak to the configured target and crowns a champion", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    addPlayer("Cara");
    clickText("Winner Stays On");
    clickText("2"); // wins in a row to take the crown
    clickText("START THE ARENA");

    await screen.findByText(/Match 1/);

    // match 1: the king (home/p1) wins
    let addGoalButtons = screen.getAllByLabelText("Add goal");
    fireEvent.click(addGoalButtons[0]);
    clickText("CONFIRM RESULT & NEXT UP");

    // match 2: the king (still home/p1 — winners stay on as p1) wins again -> crown
    await screen.findByText(/Match 2/);
    addGoalButtons = screen.getAllByLabelText("Add goal");
    fireEvent.click(addGoalButtons[0]);
    clickText("CONFIRM RESULT & NEXT UP");

    expect(await screen.findByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("2 straight wins — crown taken")).toBeInTheDocument();

    clickText(/History/);
    expect(await screen.findAllByText("Winner Stays On")).toHaveLength(2);
  });
});

describe("Pure League — full playthrough", () => {
  it("crowns the table leader with no final phase", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    clickText("Pure League");
    clickText("1");
    clickText("GENERATE FIXTURES");

    await screen.findByText(/Fixtures/);
    const addGoalButtons = screen.getAllByLabelText("Add goal");
    fireEvent.click(addGoalButtons[0]);
    clickText("Mark played");

    clickText("Table");
    expect(await screen.findByText("Champion")).toBeInTheDocument();

    clickText(/History/);
    expect(await screen.findAllByText("Pure League")).toHaveLength(2);
  });
});

describe("Best of N — full playthrough (the phase-8 proof mode)", () => {
  it("caps the roster at maxPlayers and crowns a champion once every leg is played", async () => {
    render(<App />);
    clickText("Best of N");
    addPlayer("Alice");
    addPlayer("Bob");
    addPlayer("Cara"); // should be silently rejected — mode caps at 2

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Cara")).not.toBeInTheDocument();
    expect(screen.getByText("This mode needs exactly 2 players.")).toBeInTheDocument();

    clickText("3"); // number of legs
    clickText("GENERATE LEGS");

    await screen.findByText(/Legs/);
    let addGoalButtons = screen.getAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(6); // 3 legs x 2 sides
    // make the home side win all three legs it appears in isn't guaranteed
    // (randomOrder can flip sides per leg) — instead score every match's
    // p1 twice, which strictly must beat an unscored p2 regardless of who's home.
    [0, 2, 4].forEach((i) => {
      fireEvent.click(addGoalButtons[i]);
      fireEvent.click(addGoalButtons[i]);
    });
    screen.getAllByText("Mark played").forEach((btn) => fireEvent.click(btn));

    expect(await screen.findByText("Champion")).toBeInTheDocument();

    clickText(/History/);
    expect(await screen.findAllByText("Best of N")).toHaveLength(2);
  });
});

describe("config persists across mode switches", () => {
  it("keeps legCount selected after switching away and back, matching pre-refactor behaviour", () => {
    render(<App />);
    clickText("1"); // legs per pairing, on the default League mode
    clickText("Knockout"); // knockout has no config picker
    clickText("League + Final"); // switch back

    const oneButton = screen.getByRole("button", { name: "1" });
    // selected buttons are styled with the pitch background; unselected
    // ones are white — this is the same visual signal a user relies on.
    expect(oneButton).toHaveStyle({ backgroundColor: "#1E5631" });
  });
});

describe("loading a v1 saved blob (schema migration)", () => {
  it("restores an in-progress king tournament, including the challenger queue", async () => {
    localStorage.setItem("gardenCup:current", JSON.stringify({
      players: [{ id: "p1", name: "Alice" }, { id: "p2", name: "Bob" }, { id: "p3", name: "Cara" }],
      matches: [{ id: "m1", stage: "king", seq: 1, p1: "p1", p2: "p2", s1: "2", s2: "1", played: true }],
      goals: [],
      mode: "king",
      legCount: 3,
      kingTarget: 3,
      kingQueue: ["p3"],
      tournamentId: "t1",
      historySaved: false,
    }));

    render(<App />);

    // `tab` is never persisted (matches pre-refactor behaviour) — loading
    // always lands on Players, so switch to Arena to see the restored match.
    await screen.findByText("Alice");
    clickText("Arena");

    expect(screen.getByText("Cara")).toBeInTheDocument(); // still in the queue
    expect(screen.getByText("Queue")).toBeInTheDocument();
  });

  it("restores an in-progress league tournament with its group matches intact", async () => {
    localStorage.setItem("gardenCup:current", JSON.stringify({
      players: [{ id: "p1", name: "Alice" }, { id: "p2", name: "Bob" }],
      matches: [{ id: "m1", stage: "group", leg: 1, p1: "p1", p2: "p2", s1: "0", s2: "0", played: false }],
      goals: [],
      mode: "league",
      legCount: 1,
      kingTarget: 3,
      kingQueue: [],
      tournamentId: "t2",
      historySaved: false,
    }));

    render(<App />);

    await screen.findByText(/Fixtures/);
    clickText(/Fixtures/);
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });
});
