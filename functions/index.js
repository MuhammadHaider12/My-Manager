const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();
const realtimeDb = admin.database();

/**
 * Cloud Function: Scheduled task to send daily notifications
 * Runs every 24 hours (9:00 AM UTC daily)
 * Sends pending tasks or an "add task" reminder if no tasks exist
 */
exports.sendDailyTaskNotifications = functions.pubsub
  .schedule("0 9 * * *") // 9:00 AM UTC every day
  .timeZone("UTC")
  .onRun(async (context) => {
    console.log("Starting daily task notifications job");

    try {
      // Get all users from Firestore
      const usersSnapshot = await db.collection("users").get();

      if (usersSnapshot.empty) {
        console.log("No users found");
        return null;
      }

      const promises = [];

      usersSnapshot.forEach((userDoc) => {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const fcmToken = userData.fcmToken;

        if (!fcmToken) {
          console.log(`User ${userId} has no FCM token`);
          return;
        }

        promises.push(
          processDailyNotification(userId, fcmToken)
        );
      });

      await Promise.all(promises);
      console.log("Daily task notifications completed");
      return null;
    } catch (error) {
      console.error("Error in sendDailyTaskNotifications:", error);
      throw error;
    }
  });

/**
 * Helper function to process notifications for a single user
 */
async function processDailyNotification(userId, fcmToken) {
  try {
    // Get user's tasks from Firestore
    const tasksSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("tasks")
      .get();

    let pendingTasks = [];
    let completedTasks = [];

    tasksSnapshot.forEach((taskDoc) => {
      const taskData = taskDoc.data();
      if (taskData.completed) {
        completedTasks.push(taskData);
      } else {
        pendingTasks.push({ id: taskDoc.id, ...taskData });
      }
    });

    let messageTitle = "";
    let messageBody = "";

    if (pendingTasks.length === 0) {
      // No pending tasks - encourage adding one
      messageTitle = "📝 No tasks for today!";
      messageBody = "All caught up! Add a new task to get started.";
    } else {
      // Has pending tasks - summarize them
      messageTitle = `📋 ${pendingTasks.length} task${pendingTasks.length > 1 ? "s" : ""} remaining`;
      const taskNames = pendingTasks
        .slice(0, 3)
        .map((t) => t.title)
        .join(", ");
      messageBody =
        pendingTasks.length <= 3
          ? `Tasks: ${taskNames}`
          : `Tasks: ${taskNames}...`;
    }

    // Send notification via FCM
    const message = {
      notification: {
        title: messageTitle,
        body: messageBody,
      },
      webpush: {
        fcmOptions: {
          link: process.env.APP_BASE_URL || "https://daily-tasks-8c693.web.app",
        },
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log(
      `Notification sent to user ${userId}: ${response}`
    );
  } catch (error) {
    console.error(
      `Error sending notification to user ${userId}:`,
      error
    );
  }
}

/**
 * HTTP Function: Manual trigger for testing
 * POST /sendDailyTaskNotifications to manually trigger
 */
exports.sendDailyTaskNotificationsManual = functions.https.onRequest(
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Optional: Add authentication check here
    try {
      const usersSnapshot = await db.collection("users").get();

      if (usersSnapshot.empty) {
        res.status(200).json({ message: "No users found", count: 0 });
        return;
      }

      let successCount = 0;
      let failureCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const fcmToken = userData.fcmToken;

        if (!fcmToken) {
          failureCount++;
          continue;
        }

        try {
          await processDailyNotification(userId, fcmToken);
          successCount++;
        } catch (error) {
          console.error(
            `Error processing user ${userId}:`,
            error
          );
          failureCount++;
        }
      }

      res.status(200).json({
        message: "Manual notification send completed",
        successCount,
        failureCount,
      });
    } catch (error) {
      console.error("Error in manual trigger:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Firestore trigger: send notification when a new task is created
 * Listens to: users/{userId}/tasks/{taskId}
 */
exports.onTaskCreate = functions.firestore
  .document('users/{userId}/tasks/{taskId}')
  .onCreate(async (snap, context) => {
    const { userId } = context.params;
    const task = snap.data();

    try {
      // Try to read token from top-level user doc
      const userDoc = await db.collection('users').doc(userId).get();
      let fcmToken = userDoc.exists ? userDoc.data().fcmToken : null;

      // Fallback: check fcmTokens subcollection for most recent token
      let tokenSource = 'userDoc';
      if (!fcmToken) {
        const tokensSnap = await db
          .collection('users')
          .doc(userId)
          .collection('fcmTokens')
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (!tokensSnap.empty) {
          fcmToken = tokensSnap.docs[0].data().token;
          tokenSource = 'fcmTokens_subcollection';
        }
      }

      // Fallback 2: check Realtime Database where the client may have written token
      if (!fcmToken) {
        try {
          const rtSnap = await realtimeDb.ref(`users/${userId}/fcmToken`).once('value');
          const rtVal = rtSnap.val();
          if (rtVal) {
            // client stores { token, lastTokenUpdate }
            fcmToken = rtVal.token || rtVal;
            tokenSource = 'realtimeDB';
          }
        } catch (err) {
          console.error('Error reading token from Realtime DB:', err);
        }
      }

      if (!fcmToken) {
        console.log(`No FCM token for user ${userId}, skipping notification.`);
        return null;
      }

      const message = {
        notification: {
          title: `New task: ${task.title || 'Untitled'}`,
          body: task.title ? `${task.title}` : 'You have a new task',
        },
        token: fcmToken,
      };

      console.log(`Using token from ${tokenSource} for user ${userId}:`, fcmToken);
      const response = await admin.messaging().send(message);
      console.log(`Sent new-task notification to ${userId}:`, response);
      return null;
    } catch (error) {
      console.error('Error in onTaskCreate:', error);
      return null;
    }
  });
