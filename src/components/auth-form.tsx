"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordResetAction,
  signInAction,
  updatePasswordAction,
  type AuthActionState,
} from "@/app/(auth)/actions";

const initialState: AuthActionState = { status: "idle", message: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, initialState);

  return (
    <form action={action} className="auth-form">
      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        <span>Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {state.message ? (
        <p className="form-message form-message-error" aria-live="polite">
          {state.message}
        </p>
      ) : null}
      <button className="product-button product-button-primary" disabled={pending}>
        {pending ? "Checking access…" : "Enter client system"}
      </button>
      <Link href="/forgot-password" className="auth-text-link">
        Forgot password?
      </Link>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );

  return (
    <form action={action} className="auth-form">
      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      {state.message ? (
        <p
          className={`form-message ${
            state.status === "success"
              ? "form-message-success"
              : "form-message-error"
          }`}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
      <button className="product-button product-button-primary" disabled={pending}>
        {pending ? "Sending…" : "Send recovery link"}
      </button>
      <Link href="/login" className="auth-text-link">
        Return to login
      </Link>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(
    updatePasswordAction,
    initialState,
  );

  return (
    <form action={action} className="auth-form">
      <label>
        <span>New password</span>
        <input
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </label>
      <label>
        <span>Confirm password</span>
        <input
          name="confirmation"
          type="password"
          minLength={8}
          autoComplete="new-password"
          required
        />
      </label>
      {state.message ? (
        <p
          className={`form-message ${
            state.status === "success"
              ? "form-message-success"
              : "form-message-error"
          }`}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
      <button className="product-button product-button-primary" disabled={pending}>
        {pending ? "Updating…" : "Set new password"}
      </button>
      {state.status === "success" ? (
        <Link href="/login" className="auth-text-link">
          Continue to login
        </Link>
      ) : null}
    </form>
  );
}
