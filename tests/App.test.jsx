import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
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

  it("enables the Wins tab with no live tournament, while Stats stays disabled", () => {
    render(<App />);
    const winsTab = screen.getByRole("button", { name: "Wins" });
    const statsTab = screen.getByRole("button", { name: "Stats" });
    expect(winsTab).not.toBeDisabled();
    expect(statsTab).toBeDisabled();

    fireEvent.click(winsTab);
    expect(screen.getByText(/No finished tournaments yet/)).toBeInTheDocument();
  });

  it("has a speaker toggle in the hero, on by default, reachable with no tournament in progress", () => {
    render(<App />);
    const speakerBtn = screen.getByRole("button", { name: /voice/i });
    expect(speakerBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(speakerBtn);
    expect(speakerBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(speakerBtn);
    expect(speakerBtn).toHaveAttribute("aria-pressed", "true");
  });
});
