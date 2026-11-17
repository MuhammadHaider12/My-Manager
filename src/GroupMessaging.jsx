import { useEffect, useState } from "react";
import { fs } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

function GroupMessaging({ user, onNotification }) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [joinKey, setJoinKey] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch groups where user is a member (by UID or email)
  useEffect(() => {
    // Query 1: Groups where user's UID is in members
    const q1 = query(
      collection(fs, "groups"),
      where("members", "array-contains", user.uid)
    );

    // Query 2: Groups where user's email is in memberEmails
    const q2 = query(
      collection(fs, "groups"),
      where("memberEmails", "array-contains", user.email)
    );

    let unsubscribe1, unsubscribe2;
    let groups1 = [];
    let groups2 = [];
    let loaded1 = false;
    let loaded2 = false;

    const updateGroups = () => {
      if (loaded1 && loaded2) {
        // Combine results and remove duplicates
        const combinedGroups = [...groups1, ...groups2];
        const uniqueGroups = {};
        combinedGroups.forEach((group) => {
          uniqueGroups[group.id] = group;
        });
        setGroups(Object.values(uniqueGroups));
        setLoading(false);
      }
    };

    unsubscribe1 = onSnapshot(q1, (snapshot) => {
      groups1 = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      loaded1 = true;
      updateGroups();
    });

    unsubscribe2 = onSnapshot(q2, (snapshot) => {
      groups2 = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      loaded2 = true;
      updateGroups();
    });

    return () => {
      unsubscribe1?.();
      unsubscribe2?.();
    };
  }, [user.uid, user.email]);

  // Fetch messages for selected group
  useEffect(() => {
    if (!selectedGroup) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(fs, "groups", selectedGroup.id, "messages"),
      orderBy("timestamp", "asc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(messagesList);
    });

    return unsubscribe;
  }, [selectedGroup]);

  const generateGroupKey = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const groupKey = generateGroupKey();
      await addDoc(collection(fs, "groups"), {
        name: newGroupName,
        groupKey: groupKey,
        createdBy: user.uid,
        createdByEmail: user.email,
        members: [user.uid],
        memberEmails: [user.email],
        pendingInvites: [],
        createdAt: new Date(),
      });
      setNewGroupName("");
      setShowCreateGroup(false);
      if (onNotification) {
        onNotification(`Group "${newGroupName}" created with key: ${groupKey}`);
      }
    } catch (err) {
      console.error("Error creating group:", err);
      alert("Failed to create group");
    }
  };

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    if (!joinKey.trim()) return;

    try {
      const q = query(collection(fs, "groups"), where("groupKey", "==", joinKey.toUpperCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("Group key not found");
        return;
      }

      const groupDoc = snapshot.docs[0];
      const groupId = groupDoc.id;
      const groupData = groupDoc.data();

      if (groupData.members?.includes(user.uid)) {
        alert("You are already a member of this group");
        return;
      }

      await updateDoc(doc(fs, "groups", groupId), {
        members: arrayUnion(user.uid),
        memberEmails: arrayUnion(user.email),
      });

      setJoinKey("");
      setShowJoinGroup(false);
      if (onNotification) {
        onNotification(`Successfully joined "${groupData.name}"`);
      }
    } catch (err) {
      console.error("Error joining group:", err);
      alert("Failed to join group");
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;

    if (!window.confirm(`Are you sure you want to leave "${selectedGroup.name}"?`)) {
      return;
    }

    try {
      await updateDoc(doc(fs, "groups", selectedGroup.id), {
        members: arrayRemove(user.uid),
        memberEmails: arrayRemove(user.email),
      });
      setSelectedGroup(null);
      if (onNotification) {
        onNotification(`Left group "${selectedGroup.name}"`);
      }
    } catch (err) {
      console.error("Error leaving group:", err);
      alert("Failed to leave group");
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedGroup || !memberEmail.trim()) return;

    try {
      // For this example, we'll add by email. In production, you'd want to verify the user exists.
      await updateDoc(doc(fs, "groups", selectedGroup.id), {
        memberEmails: arrayUnion(memberEmail),
      });
      setMemberEmail("");
      alert(`Invited ${memberEmail} to the group`);
    } catch (err) {
      console.error("Error adding member:", err);
      alert("Failed to add member");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedGroup) return;

    try {
      await addDoc(collection(fs, "groups", selectedGroup.id, "messages"), {
        text: newMessage,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email,
        timestamp: new Date(),
      });
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message");
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 20 }}>Loading...</div>;
  }

  return (
    <div className="group-chat-layout" style={{ display: "flex", height: "600px", gap: "15px", borderRadius: "8px" }}>
      {/* Groups Sidebar */}
      <div
        className="group-chat-sidebar"
        style={{
          flex: "0 0 280px",
          borderRight: "2px solid #e0e0e0",
          overflowY: "auto",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px 0 0 8px",
        }}
      >
        <div style={{ padding: "15px", borderBottom: "2px solid #e0e0e0" }}>
          <button
            onClick={() => setShowCreateGroup(!showCreateGroup)}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              marginBottom: "8px",
              transition: "background-color 0.3s",
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = "#45a049")}
            onMouseOut={(e) => (e.target.style.backgroundColor = "#4CAF50")}
          >
            ➕ New Group
          </button>
          <button
            onClick={() => setShowJoinGroup(!showJoinGroup)}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
              transition: "background-color 0.3s",
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = "#0b7dda")}
            onMouseOut={(e) => (e.target.style.backgroundColor = "#2196F3")}
          >
            🔗 Join Group
          </button>
        </div>

        {showCreateGroup && (
          <form
            onSubmit={handleCreateGroup}
            style={{ padding: "15px", borderBottom: "2px solid #e0e0e0", backgroundColor: "#f0f8f0" }}
          >
            <input
              type="text"
              placeholder="Group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: "10px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                boxSizing: "border-box",
                fontSize: "13px",
              }}
            />
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                marginBottom: "8px",
                fontSize: "13px",
              }}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreateGroup(false)}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Cancel
            </button>
          </form>
        )}

        {showJoinGroup && (
          <form
            onSubmit={handleJoinGroup}
            style={{ padding: "15px", borderBottom: "2px solid #e0e0e0", backgroundColor: "#f0f5ff" }}
          >
            <input
              type="text"
              placeholder="Enter group key"
              value={joinKey}
              onChange={(e) => setJoinKey(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: "10px",
                border: "1px solid #3f2121",
                borderRadius: "6px",
                boxSizing: "border-box",
                fontSize: "13px",
                color: "#333",
              }}
            />
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#2196F3",
                color: "black",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                marginBottom: "8px",
                fontSize: "13px",
              }}
            >
              Join
            </button>
            <button
              type="button"
              onClick={() => setShowJoinGroup(false)}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Cancel
            </button>
          </form>
        )}

        <div>
          {groups.length === 0 ? (
            <p style={{ padding: "15px", color: "#999", textAlign: "center", fontSize: "13px" }}>
              📭 No groups yet. Create or join one!
            </p>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                style={{
                  padding: "12px 15px",
                  borderBottom: "1px solid #e0e0e0",
                  cursor: "pointer",
                  backgroundColor:
                    selectedGroup?.id === group.id ? "#e8f5e9" : "transparent",
                  transition: "all 0.2s",
                  borderLeft: selectedGroup?.id === group.id ? "4px solid #4CAF50" : "4px solid transparent",
                }}
              >
                <div style={{ fontWeight: "bold", fontSize: "14px", color: "#333" }}>
                  {group.name}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#999",
                    marginTop: "5px",
                  }}
                >
                  🔑 Key: {group.groupKey}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginTop: "4px",
                  }}
                >
                  👥 {group.memberEmails?.length || 0} members
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="group-chat-main"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#fff",
          borderRadius: "0 8px 8px 0",
        }}
      >
        {!selectedGroup ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              fontSize: "16px",
            }}
          >
            💬 Select a group to start messaging
          </div>
        ) : (
          <>
            {/* Group Header */}
            <div
              className="group-chat-header"
              style={{
                padding: "15px",
                borderBottom: "2px solid #e0e0e0",
                backgroundColor: "#f5f5f5",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderRadius: "0 8px 0 0",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 8px 0", color: "#333" }}>{selectedGroup.name}</h3>
                <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>
                  🔑 Key: <strong>{selectedGroup.groupKey}</strong>
                </div>
                <div style={{ fontSize: "11px", color: "#999" }}>
                  👥 {selectedGroup.memberEmails?.join(", ") || ""}
                </div>
              </div>
              <button
                onClick={handleLeaveGroup}
                style={{
                  padding: "8px 15px",
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "bold",
                }}
              >
                🚪 Leave
              </button>
            </div>

            {/* Add Member Form */}
            <div className="group-chat-memberbar" style={{ padding: "12px 15px", borderBottom: "1px solid #e0e0e0", backgroundColor: "#fafafa" }}>
              <form onSubmit={handleAddMember} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="email"
                  placeholder="Invite member by email..."
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "8px 15px",
                    backgroundColor: "#2196F3",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  📧 Invite
                </button>
              </form>
            </div>

            {/* Messages List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "15px",
                backgroundColor: "#fafafa",
              }}
            >
              {messages.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "#999",
                    marginTop: "20px",
                  }}
                >
                  💬 No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      marginBottom: "12px",
                      padding: "12px",
                      backgroundColor: msg.userId === user.uid ? "#e8f5e9" : "white",
                      borderRadius: "8px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      borderLeft: msg.userId === user.uid ? "4px solid #4CAF50" : "4px solid #2196F3",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "6px",
                        fontSize: "12px",
                      }}
                    >
                      <strong style={{ color: msg.userId === user.uid ? "#4CAF50" : "#2196F3" }}>
                        {msg.userName}
                      </strong>
                      <span style={{ color: "#999" }}>
                        {msg.timestamp?.toDate?.()?.toLocaleTimeString() || ""}
                      </span>
                    </div>
                    <div style={{ fontSize: "14px", wordWrap: "break-word", color: "#333" }}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <form
              className="group-chat-inputbar"
              onSubmit={handleSendMessage}
              style={{
                padding: "15px",
                borderTop: "2px solid #e0e0e0",
                backgroundColor: "white",
                display: "flex",
                gap: "8px",
                borderRadius: "0 0 8px 0",
              }}
            >
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                style={{
                  flex: 1,
                  padding: "10px",
                  border: "1px solid #70468a",
                  borderRadius: "6px",
                  fontSize: "14px",
                  color: "#333",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                📤 Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default GroupMessaging;
