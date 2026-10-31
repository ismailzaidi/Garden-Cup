import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const auth = { login: vi.fn(), register: vi.fn() };
vi.mock("../src/auth/AuthContext.jsx", () => ({ useAuth: () => auth }));
const { default: LoginScreen } = await import("../src/auth/LoginScreen.jsx");

beforeEach(() => {
  auth.login.mockReset();
  auth.register.mockReset();
  window.history.replaceState(null, "", "/");
});

function fill(label, value) {
  const input = screen.getByText(label).parentElement.querySelector("input");
  fireEvent.change(input, { target: { value } });
}

describe("LoginScreen", () => {
  it("shows 'check your email' when sign-up needs the email link", async () => {
    auth.register.mockResolvedValue({ confirmationRequired: true });
    render(<LoginScreen />);
    fireEvent.click(screen.getByText("New here? Create an account"));
    fill("Display name", "Sam");
    fill("Email", "Sam@Example.com");
    fill("Password", "long-enough-pw");
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(screen.getByText("Check your email")).toBeTruthy());
    expect(screen.getByText("sam@example.com")).toBeTruthy();
    expect(auth.register).toHaveBeenCalledWith({ email: "sam@example.com", password: "long-enough-pw", displayName: "Sam" });

    fireEvent.click(screen.getByText("Back to sign in"));
    expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy();
  });

  it("explains a bad confirmation link and tidies the address bar", () => {
    window.history.replaceState(null, "", "/?confirm_error=1");
    render(<LoginScreen />);
    expect(screen.getByText(/confirmation link didn't work/)).toBeTruthy();
    expect(window.location.search).toBe("");
  });

  it("has no invite code field any more", () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByText("New here? Create an account"));
    expect(screen.queryByText(/invite code/i)).toBeNull();
  });
});
