import { useState } from "react";
import { auth } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

function Signup({ onSwitchToSignin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 400, margin: "0 auto" }}>
      <h2>Sign Up</h2>
      <form onSubmit={handleSignup}>
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
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          style={{ width: "100%", marginBottom: 10, boxSizing: "border-box" }}
        />
        <button type="submit" style={{ width: "100%", padding: 12 }}>
          Sign Up
        </button>
      </form>
      {error && <p style={{ color: "#ff6b6b", marginTop: 10 }}>{error}</p>}
      <p style={{ marginTop: 20, borderTop: "1px solid rgba(100,200,255,0.1)", paddingTop: 16 }}>
        Already have an account?{" "}
        <button onClick={onSwitchToSignin} style={{ background: "none", border: "none", color: "#64b5f6", cursor: "pointer", textDecoration: "underline" }}>
          Sign In
        </button>
      </p>
    </div>
  );
}

export default Signup;