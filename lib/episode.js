const { sendNotification } = require("diably-apn");

var currentEpisode = "unknown";
var currentTimestamp = null;
var lastReminder = null;
var currentHasRealTime = null;

exports.setCurrentEpisode = async function setCurrentEpisode({
  episode,
  timestamp,
  hasRealTime,
}) {
  currentEpisode = episode;
  currentTimestamp = timestamp;
  currentHasRealTime = hasRealTime;
  console.log(
    `Set episode ${episode} started at ${timestamp}, hasRealTime=${currentHasRealTime}`
  );

  // send a notification to inform the app of the current episode (if we were down it might be out of sync)
  await sendNotificationForCurrentEpisode();
};

exports.handleEpisodeChange = async function handleEpisodeChange({
  newEpisode,
  newTimestamp,
  currentCgmHasRealTime,
}) {
  if (newEpisode === currentEpisode) {
    console.log(`New episode is same as previous, weird? Not doing anything.`);
    return;
  }
  if (newEpisode === "disconnected" && currentEpisode === "low") {
    console.log(
      "Transitionning from “low” to “disconnected”, ignoring this transition as we still want to send notifications."
    );
    return;
  }
  const lastEpisode = currentEpisode;
  const lastTimestamp = currentTimestamp;
  currentEpisode = newEpisode;
  currentTimestamp = newTimestamp;
  currentHasRealTime = currentCgmHasRealTime;

  if (lastEpisode !== "unknown") {
    await handlePhaseOut({ lastEpisode, lastTimestamp, newTimestamp });
  }
  await sendNotificationForCurrentEpisode();
};
async function sendNotificationForCurrentEpisode() {
  let notification = {};
  notification.contentAvailable = true;
  notification.priority = 10;
  notification.sound = "default";
  notification.payload = {
    currentEpisodeRecord: {
      episode: currentEpisode,
      timestamp: currentTimestamp,
    },
    hasRealTime: currentHasRealTime,
  };
  console.log("Will send notification:", notification);
  await sendNotification(notification);

  lastReminder = null;
}

function convertMillisecondsToHoursAndMinutesString(milliseconds) {
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

async function handlePhaseOut({ lastEpisode, lastTimestamp, newTimestamp }) {
  const sinceMinutes = convertMillisecondsToHoursAndMinutesString(
    newTimestamp.getTime() - lastTimestamp.getTime()
  );
  let notification = {};
  notification.priority = 10;
  notification.sound = "default";
  if (lastEpisode === "disconnected") {
    notification.alert = {
      title: "\u2705 End of Sensor Disconnected",
      body: `Episode lasted ${sinceMinutes}.`,
    };
  } else if (lastEpisode === "low") {
    notification.alert = {
      title: "\u2705 End of Low",
      body: `Episode lasted ${sinceMinutes}.`,
    };
  } else if (lastEpisode === "high") {
    notification.alert = {
      title: "\u2705 End of High",
      body: `Episode lasted ${sinceMinutes}.`,
    };
  } else {
    console.log(`Not sending notification for end of episode ${lastEpisode}`);
    return;
  }
  console.log("Will send notification:", notification);
  await sendNotification(notification);
}

async function getIsNight() {
  const currentHour = new Date().getHours();
  const isNight = currentHour >= 0 && currentHour < 9;
  return isNight;
}

exports.handleReminder = async function handleReminder() {
  if (!currentTimestamp) {
    console.log("No current episode, not sending reminder");
    return;
  }
  const now = new Date();
  const lastNotificationSentAt = lastReminder || currentTimestamp;
  const durationSinceLastNotification =
    now.getTime() - lastNotificationSentAt.getTime();
  var alert = null;
  const durationInEpisode = convertMillisecondsToHoursAndMinutesString(
    now - currentTimestamp.getTime()
  );
  console.log(
    `Checking if we need to send a reminder, currentEpisode=${currentEpisode}, durationSinceLastReminder=${durationSinceLastNotification}, durationInEpisode=${durationInEpisode}`
  );
  if (currentEpisode === "disconnected") {
    if (durationSinceLastNotification < 15 * 60e3) {
      console.log(
        `Disconnected since ${durationInEpisode}, not sending reminder yet`
      );
      return;
    }
    alert = {
      title: `\u{26A0}\u{fe0f} Sensor Disconnected, Since ${durationInEpisode}`,
      body: "Scan your sensor now.",
    };
  } else if (currentEpisode === "error") {
    if (getIsNight()) {
      console.log(
        "Sensor error, but we're doing the night, not sending reminder"
      );
      return;
    }
    if (durationSinceLastNotification < 10 * 60e3) {
      console.log(
        `Sensor error since ${durationInEpisode}, not sending reminder yet`
      );
      return;
    }
    alert = {
      title: `\u{26A0}\u{fe0f} Sensor Error, Since ${durationInEpisode}`,
      body: "Scan your sensor now.",
    };
  } else if (currentEpisode === "high") {
    if (currentHasRealTime) {
      console.log("Skip high alert, current device has real-time CGM data");
    } else {
      if (getIsNight()) {
        console.log("High, but we're doing the night, not sending reminder");
        return;
      }
      if (durationSinceLastNotification < 60 * 60e3) {
        console.log(
          `High since ${durationInEpisode}, not sending reminder yet`
        );
        return;
      }
      alert = {
        title: `\u{26A0}\u{fe0f} Still High, Since ${durationInEpisode}`,
        body: "Check your blood glucose.",
      };
    }
  } else if (currentEpisode === "low") {
    if (currentHasRealTime) {
      console.log("Skip low alert, current device has real-time CGM data");
    } else {
      if (durationSinceLastNotification < 2 * 60e3) {
        console.log(`Low since ${durationInEpisode}, not sending reminder yet`);
        return;
      }
      alert = {
        title: `\u{1F6A8} Still Low, Since ${durationInEpisode}`,
        body: "Check your blood glucose.",
      };
    }
  } else {
    console.log(`Current episode is ${currentEpisode}, not sending reminder`);
    return;
  }

  if (alert === null) {
    console.error("No alert needed, bail out");
    return;
  }

  let notification = {};
  notification.priority = 10;
  notification.sound = "default";
  notification.alert = alert;
  await sendNotification(notification);
  lastReminder = now;
};
