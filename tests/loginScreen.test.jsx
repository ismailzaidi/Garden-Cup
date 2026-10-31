import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const auth = { login: vi.fn(), register: vi.fn(), forgotPassword: vi.fn() };
vi.mock("../src/auth/AuthContext.jsx", () => ({ useAuth: () => auth }));
const { default: LoginScreen } = await import("../src/auth/LoginScreen.jsx");

beforeEach(() => {
  auth.login.mockReset();
  auth.register.mockReset();
  auth.forgotPassword.mockReset();
});

function fill(label, value) {
  let el = screen.getByText(label).parentElement;
  while (el && !el.querySelector("input")) el = el.parentElement;
  const input = el.querySelector("input");
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

  it("explains a bad or expired email link", () => {
    render(<LoginScreen linkError />);
    expect(screen.getByText(/link didn't work or has expired/)).toBeTruthy();
  });

  it("sends a password reset link without saying whether the account exists", async () => {
    auth.forgotPassword.mockResolvedValue();
    render(<LoginScreen />);
    fireEvent.click(screen.getByText("Forgot password?"));
    expect(screen.queryByText("Password")).toBeNull();
    fill("Email", " Sam@Example.com ");
    fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));
    await waitFor(() => expect(screen.getByText("Check your email")).toBeTruthy());
    expect(auth.forgotPassword).toHaveBeenCalledWith("sam@example.com");
    expect(screen.getByText(/If/).textContent).toMatch(/has an account/);
  });

  it("has a way back to the app", () => {
    const onBack = vi.fn();
    render(<LoginScreen onBack={onBack} />);
    fireEvent.click(screen.getByText("Back to the app"));
    expect(onBack).toHaveBeenCalled();
  });

  it("has no invite code field any more", () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByText("New here? Create an account"));
    expect(screen.queryByText(/invite code/i)).toBeNull();
  });
});
