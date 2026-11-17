import { useEffect, useState } from "react";
import { fs, auth } from "./firebase";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";

const dbFS = fs;

function Profile({ user }) {
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);

  // Load profile from Firestore
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const docRef = doc(dbFS, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDisplayName(data.displayName || user.displayName || "");
          setPhone(data.phone || "");
          setBio(data.bio || "");
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      }
    };
    loadProfile();
  }, [user.uid]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage("");
    try {
      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: displayName,
      });

      // Save to Firestore
      await setDoc(
        doc(dbFS, "users", user.uid),
        {
          displayName,
          phone,
          bio,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      setMessage("Profile saved successfully!");
      setEditing(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Error saving profile: " + err.message);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h3>My Profile</h3>

      {message && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: message.includes("Error") ? "rgba(244,67,54,0.15)" : "rgba(76,175,80,0.15)",
            color: message.includes("Error") ? "#ff8a80" : "#90ee90",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}

      {!editing ? (
        <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12 }}>
          {/* Profile Info */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#90ee90", marginBottom: 4 }}>Name</label>
            <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12 }}>{displayName || "Not set"}</div>

            <label style={{ display: "block", fontSize: 12, color: "#90ee90", marginBottom: 4 }}>Email</label>
            <div style={{ fontSize: 14, color: "#ccc", marginBottom: 12 }}>{user.email}</div>

            <label style={{ display: "block", fontSize: 12, color: "#90ee90", marginBottom: 4 }}>Phone</label>
            <div style={{ fontSize: 14, color: "#ccc", marginBottom: 12 }}>{phone || "Not set"}</div>

            <label style={{ display: "block", fontSize: 12, color: "#90ee90", marginBottom: 4 }}>Bio</label>
            <div style={{ fontSize: 14, color: "#ccc" }}>{bio || "Not set"}</div>
          </div>

          <button onClick={() => setEditing(true)} style={{ width: "100%", padding: 12 }}>
            ✏️ Edit Profile
          </button>
        </div>
      ) : (
        <div style={{ padding: 16, background: "rgba(255,255,255,0.03)", borderRadius: 12 }}>
          {/* Edit Fields */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#90ee90", marginBottom: 6 }}>Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ width: "100%", padding: 10, marginBottom: 12, boxSizing: "border-box" }}
              placeholder="Your name"
            />

            <label style={{ display: "block", fontSize: 12, color: "#90ee90", marginBottom: 6 }}>Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: "100%", padding: 10, marginBottom: 12, boxSizing: "border-box" }}
              placeholder="Your phone number"
            />

            <label style={{ display: "block", fontSize: 12, color: "#90ee90", marginBottom: 6 }}>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ width: "100%", padding: 10, marginBottom: 12, boxSizing: "border-box", minHeight: 80, borderRadius: 8, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(100,200,255,0.15)", color: "#f0f0f0" }}
              placeholder="Tell us something about yourself..."
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={saveProfile} disabled={saving} style={{ flex: 1, padding: 12 }}>
              {saving ? "Saving..." : "💾 Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
              }}
              style={{ flex: 1, padding: 12, background: "rgba(244,67,54,0.3)", border: "1px solid rgba(244,67,54,0.4)" }}
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
