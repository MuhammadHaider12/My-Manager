import { useState } from "react";
import { auth } from "./firebase";
import { sendPasswordResetEmail } from "firebase/auth";

function ResetPassword({ onCancel }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage(
        "If an account with that email exists, a reset link has been sent."
      );
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
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", marginBottom: 10, boxSizing: "border-box" }}
        />
        <button type="submit" style={{ width: "100%", padding: 12 }}>
          Send Reset Email
        </button>
      </form>
      {message && <p style={{ color: "#4caf50", marginTop: 10 }}>{message}</p>}
      {error && <p style={{ color: "#ff6b6b", marginTop: 10 }}>{error}</p>}
      <p style={{ marginTop: 20, borderTop: "1px solid rgba(100,200,255,0.1)", paddingTop: 16 }}>
        <button
          onClick={onCancel}
          style={{ background: "none", border: "none", color: "#64b5f6", cursor: "pointer", textDecoration: "underline" }}
        >
          Back to Sign In
        </button>
      </p>
    </div>
  );
}

export default ResetPassword;