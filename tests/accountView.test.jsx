import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import AccountView from "../src/views/AccountView.jsx";

afterEach(cleanup);

function makeAuth(overrides = {}) {
  return {
    mode: "cloud",
    user: { id: "u1", email: "sam@example.com", displayName: "Sam" },
    updateDisplayName: vi.fn(async () => {}),
    changePassword: vi.fn(async () => {}),
    deleteAccount: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    ...overrides,
  };
}
const show = (auth, props = {}) => render(
  <AccountView auth={auth} banners={null} onSignIn={vi.fn()} onSignedOut={vi.fn()} onResetDone={vi.fn()} {...props} />,
);
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("My account", () => {
  it("signed out: offers sign-in and the data tools only", () => {
    const onSignIn = vi.fn();
    show(makeAuth({ user: null }), { onSignIn });
    fireEvent.click(screen.getByRole("button", { name: /sign in or create an account/i }));
    expect(onSignIn).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /download my data/i })).toBeInTheDocument();
    expect(screen.queryByText("Delete account")).toBeNull();
  });

  it("changes the display name", async () => {
    const auth = makeAuth();
    show(auth);
    expect(screen.getByText("MY ACCOUNT")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled(); // nothing changed yet
    type("Display name", " Sammy ");
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByText("Saved.")).toBeInTheDocument());
    expect(auth.updateDisplayName).toHaveBeenCalledWith("Sammy");
  });

  it("changes the password with the current one, and shows the server's error", async () => {
    const auth = makeAuth({ changePassword: vi.fn().mockRejectedValueOnce(new Error("That password isn't right")).mockResolvedValue() });
    show(auth);
    type("Current password", "old-password");
    type("New password (10+ characters)", "new-password-1");
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    await waitFor(() => expect(screen.getByText("That password isn't right")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /change password/i }));
    await waitFor(() => expect(screen.getByText("Password changed.")).toBeInTheDocument());
    expect(auth.changePassword).toHaveBeenLastCalledWith({ currentPassword: "old-password", newPassword: "new-password-1" });
  });

  it("after a reset link, sets a new password without the old one", async () => {
    const auth = makeAuth();
    const onResetDone = vi.fn();
    show(auth, { resetPassword: true, onResetDone });
    expect(screen.queryByLabelText("Current password")).toBeNull();
    type("New password (10+ characters)", "new-password-1");
    type("New password again", "new-password-2");
    fireEvent.click(screen.getByRole("button", { name: /save new password/i }));
    await waitFor(() => expect(screen.getByText("The two passwords don't match.")).toBeInTheDocument());
    expect(auth.changePassword).not.toHaveBeenCalled();

    type("New password again", "new-password-1");
    fireEvent.click(screen.getByRole("button", { name: /save new password/i }));
    await waitFor(() => expect(onResetDone).toHaveBeenCalled());
    expect(auth.changePassword).toHaveBeenCalledWith({ newPassword: "new-password-1" });
  });

  it("signs out of this device or of all devices", async () => {
    const auth = makeAuth();
    const onSignedOut = vi.fn();
    show(auth, { onSignedOut });
    fireEvent.click(screen.getByRole("button", { name: "Sign out of all devices" }));
    await waitFor(() => expect(onSignedOut).toHaveBeenCalled());
    expect(auth.logout).toHaveBeenCalledWith({ everywhere: true });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(auth.logout).toHaveBeenLastCalledWith({ everywhere: false }));
  });

  it("deletes the account only after typing DELETE and the password", async () => {
    const auth = makeAuth();
    const { rerender } = show(auth);
    fireEvent.click(screen.getByRole("button", { name: /delete my account…/i }));
    const go = screen.getByRole("button", { name: "Delete my account" });
    expect(go).toBeDisabled();
    type("Type DELETE to confirm", "delete");
    expect(go).toBeDisabled(); // still needs the password
    type("Your password", "pw-for-sam");
    expect(go).toBeEnabled();
    fireEvent.click(go);
    await waitFor(() => expect(auth.deleteAccount).toHaveBeenCalledWith("pw-for-sam"));

    // the auth context has signed out by now
    rerender(<AccountView auth={{ ...auth, user: null }} banners={null} onSignIn={vi.fn()} onSignedOut={vi.fn()} onResetDone={vi.fn()} />);
    expect(screen.getByText(/Your account has been deleted/)).toBeInTheDocument();
  });
});
