import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import InstallPrompt from "../src/components/InstallPrompt.jsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function fireBeforeInstallPrompt() {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  event.prompt = vi.fn();
  event.userChoice = Promise.resolve({ outcome: "accepted" });
  window.dispatchEvent(event);
  return event;
}

describe("InstallPrompt", () => {
  it("renders nothing until the browser offers an install prompt", () => {
    render(<InstallPrompt />);
    expect(screen.queryByText(/Add Garden Cup to your home screen/)).not.toBeInTheDocument();
  });

  it("suppresses Chrome's native banner, shows ours at the bottom, and installs on click", async () => {
    render(<InstallPrompt />);
    const event = fireBeforeInstallPrompt();
    expect(event.defaultPrevented).toBe(true); // preventDefault() is what stops the native mini-infobar

    expect(await screen.findByText(/Add Garden Cup to your home screen/)).toBeInTheDocument();

    const installBtn = screen.getByText("Install");
    fireEvent.click(installBtn);
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(installBtn).toBeDisabled();

    // prompt() may only be called once per stashed event — a second tap
    // while the first call is still in flight must be a no-op
    fireEvent.click(installBtn);
    expect(event.prompt).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(screen.queryByText(/Add Garden Cup to your home screen/)).not.toBeInTheDocument());
  });

  it("hides once the app reports itself installed", async () => {
    render(<InstallPrompt />);
    fireBeforeInstallPrompt();
    await screen.findByText(/Add Garden Cup to your home screen/);

    fireEvent(window, new Event("appinstalled"));
    expect(screen.queryByText(/Add Garden Cup to your home screen/)).not.toBeInTheDocument();
  });

  it("hides on dismiss and stays hidden across remounts", async () => {
    const { unmount } = render(<InstallPrompt />);
    fireBeforeInstallPrompt();
    await screen.findByText(/Add Garden Cup to your home screen/);

    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText(/Add Garden Cup to your home screen/)).not.toBeInTheDocument();
    unmount();

    render(<InstallPrompt />);
    fireBeforeInstallPrompt();
    expect(screen.queryByText(/Add Garden Cup to your home screen/)).not.toBeInTheDocument();
  });
});
