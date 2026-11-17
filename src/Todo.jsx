import { useEffect, useRef, useState } from "react";
import { db, fs, getFirebaseMessaging } from "./firebase";
import { getToken, onMessage } from "firebase/messaging";
import {
  ref,
  push,
  onValue,
  remove,
  update,
  set,
} from "firebase/database";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const dbFS = fs;


function Todo({ user }) {
  const [task, setTask] = useState("");
  const [tasks, setTasks] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const messagingSetupDoneRef = useRef(false);
  
  async function requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      return;
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      try {
        // make sure service worker is active; this avoids the "failed-service-worker-registration"
        const registration = await navigator.serviceWorker.ready;

        const token = await getToken(messaging, {
          vapidKey:
            "BOpnV2TzvLcXRAilh6atANPpfpDndX2NzPm4whWds8bYNRWCcnvDPtq5QqfGB4p5TZXs6m9As9zmY_mqX1iUhSQ",
          serviceWorkerRegistration: registration,
        });

        console.log("FCM token generated:", token);
        
        // Store token in Firestore (subcollection with auto-id)
        await setDoc(
          doc(dbFS, "users", user.uid, "fcmTokens", token.replace(/[.#$/\[\]]/g, "_")),
          {
            token,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          { merge: true }
        );

        // Store latest token on user's top-level Firestore doc (used by functions)
        await setDoc(
          doc(dbFS, "users", user.uid),
          { fcmToken: token, lastTokenUpdate: Date.now() },
          { merge: true }
        );

        // Store token in Realtime Database as well
        await set(ref(db, `users/${user.uid}/fcmToken`), {
          token,
          lastTokenUpdate: Date.now(),
        });
        
      } catch (err) {
        // the error you saw earlier is usually benign if a token was logged
        console.error("Unable to get messaging token", err);
      }
    } else if (permission === "denied") {
      alert("Notification permission denied. You won't receive notifications.");
    }
  }

  useEffect(() => {
    if (messagingSetupDoneRef.current) {
      return;
    }
    messagingSetupDoneRef.current = true;

    let unsubscribe = () => {};

    // request permission once on mount and also listen for foreground messages
    requestPermission();

    const setupForegroundMessages = async () => {
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        return;
      }

      // show a simple notification when a message arrives in foreground
      unsubscribe = onMessage(messaging, (payload) => {
        console.log("Foreground message received:", payload);
        if (payload.notification && typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(payload.notification.title, {
            body: payload.notification.body,
          });
        }
      });
    };

    setupForegroundMessages();

    return () => {
      unsubscribe();
    };
  }, [user.uid]);

  // 🔁 Realtime listener
  useEffect(() => {
    const tasksRef = ref(db, `users/${user.uid}/tasks`);

    const unsubscribe = onValue(
      tasksRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setTasks([]);
          return;
        }

        const formatted = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));

        setTasks(formatted);
      },
      (err) => {
        console.error("Unable to read tasks from Realtime Database:", err);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  // ➕ Add task
  const addTask = async () => {
    if (!task.trim()) return;

    const taskData = {
      title: task,
      completed: false,
      createdAt: Date.now(),
    };

    try {
      const newTaskRef = await push(ref(db, `users/${user.uid}/tasks`), taskData);
      const taskId = newTaskRef.key;

      await setDoc(doc(dbFS, "users", user.uid, "tasks", taskId), taskData);
      setTask("");
    } catch (err) {
      console.error("Add task failed:", err);
      alert("Unable to add task. Check Firebase permissions and try again.");
    }
  };

  // ❌ Delete task
  const deleteTask = async (id) => {
    try {
      await remove(ref(db, `users/${user.uid}/tasks/${id}`));
      await deleteDoc(doc(dbFS, "users", user.uid, "tasks", id));
    } catch (err) {
      console.error("Delete task failed:", err);
      alert("Unable to delete task. Check Firebase permissions and try again.");
    }
  };

  // ✔ Toggle completed
  const toggleTask = async (id, status) => {
    await updateTask(id, { completed: !status });
  };

  // ✏️ Update task
  const updateTask = async (id, updates) => {
    try {
      await update(ref(db, `users/${user.uid}/tasks/${id}`), updates);
      await updateDoc(doc(dbFS, "users", user.uid, "tasks", id), updates);
    } catch (err) {
      console.error("Update task failed:", err);
      alert("Unable to update task. Check Firebase permissions and try again.");
    }
  };

  // Edit functions
  const startEdit = (id, currentTitle) => {
    setEditingId(id);
    setEditingText(currentTitle);
  };

  const saveEdit = async () => {
    if (editingText.trim()) {
      await updateTask(editingId, { title: editingText.trim() });
    }
    setEditingId(null);
    setEditingText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  return (
    <div>
      <input
        value={task}
        onChange={(e) => setTask(e.target.value)}
        placeholder="Enter new task"
        style={{ width: "100%", padding: 8 }}
      />

      <button onClick={addTask} style={{ marginTop: 10 }}>
        Add Task
      </button>

      <h4 style={{ marginTop: 20 }}>Tasks</h4>
      <ul style={{ marginTop: 6, padding: 0, listStyle: 'none' }}>
        {tasks.filter(t => !t.completed).map((t) => (
          <li key={t.id} style={{ marginBottom: 8 }}>
            {editingId === t.id ? (
              <div>
                <input
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  style={{ width: "60%", padding: 4 }}
                />
                <button onClick={saveEdit} style={{ marginLeft: 5 }}>
                  Save
                </button>
                <button onClick={cancelEdit} style={{ marginLeft: 5 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={!!t.completed}
                  onChange={() => toggleTask(t.id, t.completed)}
                  style={{ marginRight: 10 }}
                />
                <span style={{ flex: 1 }}>{t.title}</span>
                <button
                  onClick={() => startEdit(t.id, t.title)}
                  style={{ marginLeft: 10 }}
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteTask(t.id)}
                  style={{ marginLeft: 10 }}
                >
                  ❌
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <h4 style={{ marginTop: 20 }}>Completed ({tasks.filter(t => t.completed).length})</h4>
      <ul style={{ marginTop: 6, padding: 0, listStyle: 'none' }}>
        {tasks.filter(t => t.completed).map((t) => (
          <li key={t.id} style={{ marginBottom: 8, opacity: 0.9 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={true}
                onChange={() => toggleTask(t.id, t.completed)}
                style={{ marginRight: 10 }}
              />
              <span style={{ textDecoration: 'line-through', flex: 1 }}>{t.title}</span>
              <button onClick={() => deleteTask(t.id)} style={{ marginLeft: 10 }}>❌</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Todo;