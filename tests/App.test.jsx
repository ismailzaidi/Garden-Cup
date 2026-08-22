import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../src/App.jsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("App", () => {
  it("mounts and shows the hero and the default mode's setup screen", () => {
    render(<App />);
    expect(screen.getByText("GARDEN CUP")).toBeInTheDocument();
    expect(screen.getByText("Game mode")).toBeInTheDocument();
    expect(screen.getByText("League + Final")).toBeInTheDocument();
    expect(screen.getByText("Add at least 2 players to start")).toBeInTheDocument();
  });
});
