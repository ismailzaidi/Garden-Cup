import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock("../src/lib/apiClient.js", () => ({
  hasApi: () => true,
  apiRequest: apiRequestMock,
  onUnauthorized: () => () => {},
  ApiError: class ApiError extends Error {},
  API_BASE: "/api",
}));

const sync = await import("../src/lib/syncEngine.js");
const { default: ConflictBanner } = await import("../src/components/ConflictBanner.jsx");

const mine = { mode: "king", tournamentId: "t1" };

beforeEach(() => {
  localStorage.clear();
  apiRequestMock.mockReset();
  apiRequestMock.mockResolvedValue({ version: 2 });
  sync.setSessionActive(false);
  sync.setSessionActive(true, "u1");
});

describe("ConflictBanner", () => {
  it("renders nothing without a backup", () => {
    const { container } = render(<ConflictBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows up for a backup already on disk (survives a reload) and 'Restore my version' puts it back and pushes it", async () => {
    localStorage.setItem("gardenCup:conflictBackup", JSON.stringify({ savedAt: "x", state: mine }));
    render(<ConflictBanner />);
    expect(screen.getByRole("alert")).toHaveTextContent("Another device saved a newer tournament");

    await act(async () => { fireEvent.click(screen.getByText("Restore my version")); });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(JSON.parse(localStorage.getItem("gardenCup:current"))).toEqual(mine);
    expect(apiRequestMock).toHaveBeenCalledWith("/tournaments/current", expect.objectContaining({ method: "PUT" }));
  });

  it("appears when a conflict happens while mounted, and 'Keep theirs' discards the backup", () => {
    render(<ConflictBanner />);
    act(() => {
      localStorage.setItem("gardenCup:conflictBackup", JSON.stringify({ savedAt: "x", state: mine }));
      window.dispatchEvent(new CustomEvent(sync.CONFLICT_EVENT));
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Keep theirs"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(localStorage.getItem("gardenCup:conflictBackup")).toBeNull();
  });
});
