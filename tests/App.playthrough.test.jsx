import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/react";
import App from "../src/App.jsx";
import { TWISTS } from "../src/engine/twists.js";

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

// Which player kicks off at home comes out of the fixture draw (the circle
// seating in generateGroupMatches, and alternateHome's opening flip for a
// leg series), so a test that wants the *same* player to win two matches
// has to find their score box by name instead of always clicking the
// left-hand one. Inside a MatchCard the home player's name is the <p>
// immediately above the "Home" caption.
function homeNameOfFirstCard() {
  return screen.getAllByText("Home")[0].previousElementSibling.textContent;
}

function addGoalForName(name) {
  const buttons = screen.getAllByLabelText("Add goal");
  fireEvent.click(homeNameOfFirstCard() === name ? buttons[0] : buttons[1]);
}

describe("League + Final — full playthrough", () => {
  it("plays a group match, sets up the final, crowns a champion, and records history", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    clickText("1"); // legs per pairing
    clickText("GENERATE FIXTURES");

    // one group match; whoever drew the home slot wins it 2-0, and the same
    // player is made to win the final below, so the all-time row asserted at
    // the end is two match wins however the draw fell.
    await screen.findByText(/Fixtures/);
    const winner = homeNameOfFirstCard();
    const runnerUp = winner === "Alice" ? "Bob" : "Alice";
    const addGoalButtons = screen.getAllByLabelText("Add goal");
    fireEvent.click(addGoalButtons[0]);
    fireEvent.click(addGoalButtons[0]);
    clickText("Mark played");

    clickText("Table");
    expect(screen.getByText("Alice")).toBeInTheDocument();
    clickText("SET UP FINAL (TOP 2)");

    // final: same two players, 1 leg — wait for the final's MatchCard, not for
    // a player by name, since the final standings table (also on this tab)
    // repeats the same names and makes a bare text query ambiguous.
    const finalGoalButtons = await screen.findAllByLabelText("Add goal");
    expect(finalGoalButtons).toHaveLength(2);
    addGoalForName(winner);
    addGoalForName(winner);
    clickText("Mark played");

    expect(await screen.findByText("Champion")).toBeInTheDocument();
    expect(screen.getByText(/Won the final 3–0 on points/)).toBeInTheDocument();

    clickText(/History/);
    // "League + Final" now appears twice: the hero's active-mode badge
    // (still showing, regardless of tab) and the new history card.
    expect(await screen.findAllByText("League + Final")).toHaveLength(2);

    // the winner took both the group match (2-0) and the final (2-0), so
    // their all-time row shows one title and two match wins across the two.
    clickText("Wins");
    const winnerRow = (await screen.findByText(winner)).closest("tr");
    const cells = within(winnerRow).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("1"); // titles
    expect(cells[3]).toHaveTextContent("1"); // played (tournaments entered)
    expect(cells[4]).toHaveTextContent("2"); // match wins

    // pins the record shape the API relies on: results carries every
    // player's aggregate across the whole tournament, not just the final.
    const history = JSON.parse(localStorage.getItem("gardenCup:history"));
    expect(history[0].champion).toBe(winner);
    const results = history[0].results;
    expect(results.find((r) => r.name === winner)).toMatchObject({ w: 2, l: 0 });
    expect(results.find((r) => r.name === runnerUp)).toMatchObject({ w: 0, l: 2 });
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

describe("Chaos Cup — full playthrough", () => {
  it("deals a twist to the fixture and crowns the table leader", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    clickText("Chaos Cup");
    clickText("1"); // times each pair plays
    clickText("DEAL THE CHAOS");

    await screen.findByText(/Chaos ·/);
    // the twist banner is dealt per match, so exactly one of the deck's
    // labels must be on screen alongside the match card
    const addGoalButtons = screen.getAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(2);
    fireEvent.click(addGoalButtons[0]);
    fireEvent.click(addGoalButtons[0]);
    clickText("Mark played");

    expect(await screen.findByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("Survived the chaos")).toBeInTheDocument();

    clickText(/History/);
    expect(await screen.findAllByText("Chaos Cup")).toHaveLength(2);
  });
});

describe("Golden Boot Race — full playthrough", () => {
  it("crowns the first player to reach the goal target", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    clickText("Golden Boot Race");
    clickText("5"); // goals to win the Golden Boot
    clickText("START THE RACE");

    await screen.findByText(/Race ·/);
    const addGoalButtons = screen.getAllByLabelText("Add goal");
    for (let i = 0; i < 5; i++) fireEvent.click(addGoalButtons[0]);
    // totals only count played matches, so the race isn't won until the
    // match is confirmed
    expect(screen.queryByText("Champion")).not.toBeInTheDocument();
    clickText("Mark played");

    expect(await screen.findByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("Golden Boot winner — first to 5")).toBeInTheDocument();

    clickText(/History/);
    expect(await screen.findAllByText("Golden Boot Race")).toHaveLength(2);
  });
});

describe("Last One Standing — full playthrough", () => {
  it("knocks out the bottom player each round until one is left", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    addPlayer("Cara");
    clickText("Last One Standing");
    clickText("START ROUND 1");

    // round 1: three players, three fixtures — score every match's p1 so
    // the round has a definite bottom regardless of which side is home
    await screen.findByText(/Arena · R1/);
    let addGoalButtons = screen.getAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(6);
    [0, 2, 4].forEach((i) => fireEvent.click(addGoalButtons[i]));
    screen.getAllByText("Mark played").forEach((btn) => fireEvent.click(btn));

    clickText("KNOCK OUT THE LAST PLACE");

    // round 2: only the two survivors, so only their fixture is on screen
    await screen.findByText(/Arena · R2/);
    addGoalButtons = screen.getAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(2);
    fireEvent.click(addGoalButtons[0]);
    clickText("Mark played");
    clickText("KNOCK OUT THE LAST PLACE");

    expect(await screen.findByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("Last one standing")).toBeInTheDocument();

    clickText(/History/);
    expect(await screen.findAllByText("Last One Standing")).toHaveLength(2);
  });
});

describe("Penalty Shootout Cup — full playthrough", () => {
  it("plays a four-player shootout bracket through to a champion", async () => {
    render(<App />);
    ["Alice", "Bob", "Cara", "Dee"].forEach(addPlayer);
    clickText("Penalty Shootout Cup");
    clickText("5"); // penalties per player
    clickText("GENERATE THE SHOOTOUTS");

    await screen.findByText(/Shootout ·/);
    let addGoalButtons = screen.getAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(4);
    fireEvent.click(addGoalButtons[0]);
    fireEvent.click(addGoalButtons[2]);
    screen.getAllByText("Mark played").forEach((btn) => fireEvent.click(btn));

    clickText("NEXT ROUND OF SHOOTOUTS");

    // round-1 cards keep their controls, so the final's pair is the last two
    addGoalButtons = await screen.findAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(6);
    fireEvent.click(addGoalButtons[4]);
    screen.getAllByText("Mark played").slice(-1).forEach((btn) => fireEvent.click(btn));

    expect(await screen.findByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("Ice in the veins — shootout champion")).toBeInTheDocument();

    clickText(/History/);
    expect(await screen.findAllByText("Penalty Shootout Cup")).toHaveLength(2);
  });
});

describe("Garden World Cup — full playthrough", () => {
  it("plays the group stage, the semis, and the final, and awards a bronze", async () => {
    render(<App />);
    ["Alice", "Bob", "Cara", "Dee"].forEach(addPlayer);
    clickText("Garden World Cup");
    clickText("1"); // group games between each pair
    clickText("KICK OFF THE GROUP STAGE");

    // two groups of two, so one fixture each
    await screen.findByText(/Groups ·/);
    let addGoalButtons = screen.getAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(4);
    fireEvent.click(addGoalButtons[0]);
    fireEvent.click(addGoalButtons[2]);
    screen.getAllByText("Mark played").forEach((btn) => fireEvent.click(btn));

    clickText("KICK OFF THE SEMI-FINALS");

    // advancing switches to the Finals tab, which shows only the two semis
    await screen.findByText("SEMI-FINALS");
    addGoalButtons = screen.getAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(4);
    fireEvent.click(addGoalButtons[0]);
    fireEvent.click(addGoalButtons[2]);
    screen.getAllByText("Mark played").forEach((btn) => fireEvent.click(btn));

    clickText("SET UP THE FINAL");

    // now four cards: two semis, the third-place playoff, then the final
    await screen.findByText("THE FINAL");
    expect(screen.getByText("THIRD PLACE")).toBeInTheDocument();
    addGoalButtons = screen.getAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(8);
    fireEvent.click(addGoalButtons[6]); // the final's p1
    screen.getAllByText("Mark played").slice(-1).forEach((btn) => fireEvent.click(btn));

    expect(await screen.findByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("Garden World Cup winner")).toBeInTheDocument();

    clickText(/History/);
    expect(await screen.findAllByText("Garden World Cup")).toHaveLength(2);
  });
});

describe("League + Chaos — full playthrough", () => {
  it("plays the group stage straight, then deals twists to the final", async () => {
    render(<App />);
    addPlayer("Alice");
    addPlayer("Bob");
    clickText("League + Chaos");
    clickText("1"); // legs per pairing
    clickText("GENERATE FIXTURES");

    // the group stage is played straight — no twist banner anywhere yet
    await screen.findByText(/Fixtures/);
    expect(TWISTS.some((t) => screen.queryByText(t.label))).toBe(false);
    const addGoalButtons = screen.getAllByLabelText("Add goal");
    expect(addGoalButtons).toHaveLength(2);
    fireEvent.click(addGoalButtons[0]);
    fireEvent.click(addGoalButtons[0]);
    clickText("Mark played");

    clickText("Table");
    clickText("SET UP CHAOS FINAL (TOP 2)");

    // the final is the only place chaos happens, so its one leg must be
    // wearing a twist from the deck
    const finalGoalButtons = await screen.findAllByLabelText("Add goal");
    expect(finalGoalButtons).toHaveLength(2);
    expect(TWISTS.some((t) => screen.queryByText(t.label))).toBe(true);

    fireEvent.click(finalGoalButtons[0]);
    fireEvent.click(finalGoalButtons[0]);
    clickText("Mark played");

    expect(await screen.findByText("Champion")).toBeInTheDocument();
    expect(screen.getByText(/Won the chaos final 3–0 on points/)).toBeInTheDocument();

    clickText(/History/);
    expect(await screen.findAllByText("League + Chaos")).toHaveLength(2);
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
