
import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Todo from "./Todo";
import Finance from "./Finance";
import Profile from "./Profile";
import GroupMessaging from "./GroupMessaging";
import Signin from "./Signin";
import Signup from "./Signup";
import ResetPassword from "./ResetPassword";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("signin"); // "signin" | "signup" | "reset"
  const [view, setView] = useState("dashboard"); // dashboard | todo | finance | profile | messaging
  const [notifications, setNotifications] = useState([]);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const addNotification = (message) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  };

  if (user) {

    if (view === "todo") {
      return (
        <div className="view-shell" style={{ maxWidth: 900, margin: "24px auto", padding: "0 12px" }}>
          <div className="view-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2>📝 Tasks</h2>
            <div className="view-actions">
              <button onClick={() => setView("dashboard")} style={{ marginRight: 8 }}>Back</button>
              <button onClick={handleLogout}>Logout</button>
            </div>
          </div>
          <div className="card">
            <Todo user={user} />
          </div>
        </div>
      );
    }

    if (view === "finance") {
      return (
        <div className="view-shell" style={{ maxWidth: 900, margin: "24px auto", padding: "0 12px" }}>
          <div className="view-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2>💰 Finance</h2>
            <div className="view-actions">
              <button onClick={() => setView("dashboard")} style={{ marginRight: 8 }}>Back</button>
              <button onClick={handleLogout}>Logout</button>
            </div>
          </div>
          <div className="card">
            <Finance user={user} />
          </div>
        </div>
      );
    }

    if (view === "profile") {
      return (
        <div className="view-shell" style={{ maxWidth: 900, margin: "24px auto", padding: "0 12px" }}>
          <div className="view-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2>👤 My Profile</h2>
            <div className="view-actions">
              <button onClick={() => setView("dashboard")} style={{ marginRight: 8 }}>Back</button>
              <button onClick={handleLogout}>Logout</button>
            </div>
          </div>
          <div className="card">
            <Profile user={user} />
          </div>
        </div>
      );
    }

    if (view === "messaging") {
      return (
        <div className="view-shell messaging-shell" style={{ maxWidth: 1200, margin: "24px auto", padding: "0 12px" }}>
          {/* Notifications */}
          <div
            style={{
              position: "fixed",
              top: "16px",
              left: "16px",
              zIndex: 1000,
              maxWidth: "300px",
            }}
          >
            {notifications.map((notif) => (
              <div
                key={notif.id}
                style={{
                  backgroundColor: "#4CAF50",
                  color: "white",
                  padding: "12px 16px",
                  borderRadius: "6px",
                  marginBottom: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  fontSize: "14px",
                  animation: "slideIn 0.3s ease-out",
                }}
              >
                ✓ {notif.message}
              </div>
            ))}
          </div>
          <div className="view-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2>💬 Group Messaging</h2>
            <div className="view-actions">
              <button onClick={() => setView("dashboard")} style={{ marginRight: 8 }}>Back</button>
              <button onClick={handleLogout}>Logout</button>
            </div>
          </div>
          <div className="card">
            <GroupMessaging user={user} onNotification={addNotification} />
          </div>
        </div>
      );
    }

    return (
      <div className="dashboard-shell" style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 12px", minHeight: "100vh" }}>
        <div className="welcome-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Welcome, {user.displayName || user.email}! 👋</h2>
          <button onClick={handleLogout} style={{ padding: "10px 20px", fontSize: "15px", fontWeight: "600" }}>
            🚪 Logout
          </button>
        </div>

        <div className="dashboard-container">
          <div className="dashboard-grid">
            <div onClick={() => setView("todo")} className="card dashboard-card">
              <h3>📝 Task Manager</h3>
              <p>Manage your daily tasks in realtime.</p>
            </div>

            <div onClick={() => setView("finance")} className="card dashboard-card">
              <h3>💰 Finance Manager</h3>
              <p>Track customers and cash given or taken.</p>
            </div>

            <div onClick={() => setView("messaging")} className="card dashboard-card">
              <h3>💬 Group Messaging</h3>
              <p>Create and join groups to chat with team members.</p>
            </div>

            <div onClick={() => setView("profile")} className="card dashboard-card">
              <h3>👤 My Profile</h3>
              <p>View and edit your profile information.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      {authMode === "signin" && (
        <Signin
          onSwitchToSignup={() => setAuthMode("signup")}
          onForgotPassword={() => setAuthMode("reset")}
        />
      )}
      {authMode === "signup" && (
        <Signup onSwitchToSignin={() => setAuthMode("signin")} />
      )}
      {authMode === "reset" && (
        <ResetPassword onCancel={() => setAuthMode("signin")} />
      )}
    </div>
  );
}

export default App;

