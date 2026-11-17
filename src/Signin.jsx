import { useState } from "react";
import { auth, googleProvider } from "./firebase";
import { signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail } from "firebase/auth";

function Signin({ onSwitchToSignup, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleEmailSignin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email above to reset your password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setError("Password reset email sent. Check your inbox.");
      // Show browser notification
      if (Notification.permission === "granted") {
        new Notification("Password Reset", {
          body: `A password reset link has been sent to ${email}`,
        });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 400, margin: "0 auto" }}>
      <h2>Sign In</h2>
      <form onSubmit={handleEmailSignin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", marginBottom: 10, boxSizing: "border-box" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", marginBottom: 10, boxSizing: "border-box" }}
        />
        <button type="submit" style={{ width: "100%", padding: 12 }}>
          Sign In
        </button>
      </form>
    
      <button
        onClick={handleGoogleSignin}
        style={{ width: "100%", padding: 12, marginTop: 10, background: "linear-gradient(135deg, #4285f4 0%, #1f6feb 100%)" }}
      >
        Sign In with Google
      </button>
      {error && <p style={{ color: "#ff6b6b", marginTop: 10 }}>{error}</p>}
      <p style={{ marginTop: 10, textAlign: "right" }}>
        <button
          onClick={onForgotPassword}
          style={{ background: "none", border: "none", color: "#64b5f6", cursor: "pointer", textDecoration: "underline" }}
        >
          Forgot password?
        </button>
      </p>
      <p style={{ marginTop: 20, borderTop: "1px solid rgba(100,200,255,0.1)", paddingTop: 16 }}>
        Don't have an account?{" "}
        <button onClick={onSwitchToSignup} style={{ background: "none", border: "none", color: "#64b5f6", cursor: "pointer", textDecoration: "underline" }}>
          Sign Up
        </button>
      </p>
    </div>
  );
}

export default Signin;