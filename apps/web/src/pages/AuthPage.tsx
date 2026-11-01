import { useEffect, useState, type SyntheticEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import EarshotDiagram from "../components/EarshotDiagram";
import { CheckboxField, PasswordField, TextField } from "../components/form/fields";
import {
  AlertIcon,
  AtSignIcon,
  GoogleIcon,
  LockIcon,
  MailIcon,
  UserIcon,
} from "../components/Icons";
import Logo from "../components/Logo";
import { api } from "../lib/api";
import { PRIVACY_POLICY_PATH } from "../lib/legal";
import {
  normalizeUsername,
  validateEmail,
  validateExistingPassword,
  validateName,
  validateNewPassword,
  validatePrivacyConsent,
  validateUsername,
} from "../lib/validation";
import { useAuthStore } from "../store/auth.store";

export default function AuthPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const submitting = useAuthStore((s) => s.submitting);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const [mode, setMode] = useState<"login" | "signup">(() =>
    params.get("mode") === "signup" ? "signup" : "login",
  );
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });
  // Creating an account means accepting the Privacy Policy. The server insists too; this is the box.
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [attempted, setAttempted] = useState(false); // after the first submit, every problem is shown at once
  const [formError, setFormError] = useState<string | null>(null);
  const isSignup = mode === "signup";
  // The server says whether Google sign-in is configured; don't offer a button that can't work.
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    api<{ google: boolean }>("/auth/providers")
      .then((p) => setGoogleEnabled(p.google))
      .catch(() => setGoogleEnabled(false));
  }, []);

  // Google errors come back as /auth?error=...: shown as-is, and cleared the moment the person acts
  const urlError = params.get("error");
  const shownError = formError ?? urlError;
  const clearErrors = () => {
    if (formError) setFormError(null);
    if (urlError) setParams({}, { replace: true });
  };

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({
      ...f,
      [key]: key === "username" ? normalizeUsername(value) : value,
    }));
    clearErrors();
  };

  const errors = {
    name: isSignup ? validateName(form.name) : null,
    username: isSignup ? validateUsername(form.username) : null,
    email: validateEmail(form.email),
    password: isSignup
      ? validateNewPassword(form.password)
      : validateExistingPassword(form.password),
    policy: isSignup ? validatePrivacyConsent(acceptedPolicy) : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setAttempted(false);
    clearErrors();
  }

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setAttempted(true);
    if (hasErrors) {
      // take the person straight to the first thing to fix
      setTimeout(
        () =>
          document
            .querySelector<HTMLElement>('.auth-card [aria-invalid="true"]')
            ?.focus(),
        0,
      );
      return;
    }
    clearErrors();
    try {
      if (isSignup)
        await register({
          ...form,
          name: form.name.trim(),
          email: form.email.trim(),
          acceptPrivacyPolicy: acceptedPolicy,
        });
      else await login(form.email.trim(), form.password);
      toast.success(isSignup ? "Account created" : "Welcome back");
      navigate("/home", { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function onGoogle() {
    try {
      await signInWithGoogle();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="auth">
      <aside className="auth-art">
        <Logo />
        <EarshotDiagram />
        <div className="auth-copy">
          <h2>Walk over to a conversation.</h2>
          <p>
            Rooms you can move around in. Stand close to someone and you hear
            them clearly; step away and they fade, like in a real room.
          </p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <span className="auth-mobile-logo">
            <Logo />
          </span>

          <div>
            <h1>{isSignup ? "Create your account" : "Welcome back"}</h1>
            <p className="sub">
              {isSignup
                ? "Pick a name, then walk into a room."
                : "Log in to jump back into your rooms."}
            </p>
          </div>

          <div className="tabs" role="tablist" aria-label="Log in or sign up">
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={!isSignup}
              onClick={() => switchMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={isSignup}
              onClick={() => switchMode("signup")}
            >
              Sign up
            </button>
          </div>

          {googleEnabled && (
            <>
              <button
                type="button"
                className="btn btn-outline btn-lg btn-block"
                onClick={onGoogle}
              >
                <GoogleIcon />
                Continue with Google
              </button>
              <div className="divider">or use your email</div>
            </>
          )}

          <form onSubmit={onSubmit} className="form" noValidate>
            {shownError && (
              <p className="notice notice-error" role="alert">
                <AlertIcon size={16} />
                {shownError}
              </p>
            )}
            {isSignup && (
              <div className="row">
                <TextField
                  label="Name"
                  icon={<UserIcon size={18} />}
                  value={form.name}
                  onValueChange={set("name")}
                  error={errors.name}
                  showError={attempted}
                  maxLength={50}
                  autoComplete="name"
                  enterKeyHint="next"
                  placeholder="Maya Chen"
                />
                <TextField
                  label="Username"
                  icon={<AtSignIcon size={18} />}
                  value={form.username}
                  onValueChange={set("username")}
                  error={errors.username}
                  showError={attempted}
                  valid
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  placeholder="maya_c"
                />
              </div>
            )}
            <TextField
              label="Email"
              icon={<MailIcon size={18} />}
              type="email"
              inputMode="email"
              value={form.email}
              onValueChange={set("email")}
              error={errors.email}
              showError={attempted}
              valid
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="you@example.com"
            />
            <PasswordField
              label="Password"
              icon={<LockIcon size={18} />}
              value={form.password}
              onValueChange={set("password")}
              error={errors.password}
              showError={attempted}
              meter={isSignup}
              hint={
                isSignup
                  ? "At least 8 characters. A longer phrase beats a clever short one."
                  : undefined
              }
              autoComplete={isSignup ? "new-password" : "current-password"}
              enterKeyHint="go"
            />
            {isSignup && (
              <CheckboxField
                checked={acceptedPolicy}
                onChange={(v) => {
                  setAcceptedPolicy(v);
                  clearErrors();
                }}
                error={errors.policy}
                showError={attempted}
              >
                I have read and accept the{" "}
                <a href={PRIVACY_POLICY_PATH} target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
                .
              </CheckboxField>
            )}
            <button
              type="submit"
              className="btn btn-lg btn-block"
              disabled={submitting}
            >
              {submitting && <span className="spinner" aria-hidden="true" />}
              {submitting
                ? "Please wait…"
                : isSignup
                  ? "Create account"
                  : "Log in"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
