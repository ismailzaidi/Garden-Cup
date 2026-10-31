import { render, screen, within, fireEvent } from "@testing-library/react";
import App from "../../src/App.jsx";

/* The app opens on Home; most tests are about the tournament itself, so
   this renders it and taps Play in the bottom navigation, as a person would. */
export function renderApp() {
  const result = render(<App />);
  goTo("Play");
  return result;
}

/** Taps a bottom-navigation item ("Home", "Play", "My account", "Sign in", "My data"). */
export function goTo(label) {
  const nav = screen.getByRole("navigation", { name: "Main" });
  fireEvent.click(within(nav).getByRole("button", { name: new RegExp(`^${label}`) }));
}
