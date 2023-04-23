const http = require("http");

const reminderInterval = 120e3;
const port = Number(process.env.PORT || 6503);

async function handleReqEpisodeChanged(res, body) {
  const data = JSON.parse(body);
  console.log("Parsed change", JSON.stringify(data, null, 2));
  res.end("OK");

  const newEpisode = data.new.episode;
  const newTimestamp = new Date(data.new.timestamp);
  const cgmProperties = data["cgm-properties"];
  const hasRealTime = cgmProperties["has-real-time"];

  console.log(
    `Got an episode change, newEpisode=${newEpisode}, newTimestamp=${newTimestamp}, hasRealTime=${hasRealTime}`
  );
}

(async () => {
  // create an HTTP server
  const s = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      const path = req.url;
      console.log(`Handling request for ${path}`);
      const body = Buffer.concat(chunks).toString();
      if (path === "/episode-changed") {
        return await handleReqEpisodeChanged(res, body);
      } else {
        res.statusCode = 404;
        res.end("Not found");
      }
    });
  });
  s.listen(port);
  console.log(`Listening on port ${port}`);
  console.log("Current date: ", new Date().toLocaleString());
})();

function scheduleReminder() {
  setTimeout(async () => {
    try {
      // TODO send reminders if we're in an episode for too long
    } finally {
      scheduleReminder();
    }
  }, reminderInterval);
}
scheduleReminder();
