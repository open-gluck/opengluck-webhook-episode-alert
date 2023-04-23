const http = require("http");
const https = require("https");
const {
  handleEpisodeChange,
  setCurrentEpisode,
  handleReminder,
} = require("./lib/episode");
require("dotenv").config();

const reminderInterval = 60e3;
const port = Number(process.env.PORT || 6503);

async function handleReqEpisodeChanged(res, body) {
  const data = JSON.parse(body);
  console.log("Parsed change", JSON.stringify(data, null, 2));
  res.end("OK");

  const newEpisode = data.new.episode;
  const newTimestamp = new Date(data.new.timestamp);
  const cgmProperties = data["cgm-properties"];
  const hasRealTime = cgmProperties["has-real-time"];

  await handleEpisodeChange({ newEpisode, newTimestamp });

  console.log(
    `Got an episode change, newEpisode=${newEpisode}, newTimestamp=${newTimestamp}, hasRealTime=${hasRealTime}`
  );
}

(async () => {
  // get the current episode, to set things up
  // we do so by making an HTTP request to the OpenGlück server
  await new Promise((resolve, reject) => {
    const req = https.request(
      `${process.env.OPENGLUCK_URL}/opengluck/episode/current`,
      { headers: { authorization: `Bearer ${process.env.OPENGLUCK_TOKEN}` } },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString();
          const data = JSON.parse(body);
          console.log("Current episode", data);
          if (data) {
            setCurrentEpisode({
              episode: data.episode,
              timestamp: new Date(data.timestamp),
            });
          }
          resolve();
        });
        res.on("error", reject);
      }
    );
    req.end();
  });

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
      await handleReminder();
    } finally {
      scheduleReminder();
    }
  }, reminderInterval);
}
scheduleReminder();
