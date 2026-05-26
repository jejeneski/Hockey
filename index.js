const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const express = require("express");

const app = express();

// 🌐 WEB SERVER
app.get("/", (req, res) => {
  res.send("🏒 Hockey Bot Online");
});

app.listen(3000, () => {
  console.log("🌐 Web server running");
});

// 🤖 DISCORD CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 🔐 ENV VARIABLES
const TOKEN = process.env.TOKEN;

const CHANNELS = {
  live: process.env.CHANNEL_LIVE,
  standings: process.env.CHANNEL_STANDINGS,
  players: process.env.CHANNEL_PLAYERS,
  playoffs: process.env.CHANNEL_PLAYOFFS
};

// 🧠 MESSAGE STORAGE
let liveMessages = {};
let standingsMessage = null;
let playersMessage = null;
let playoffsMessage = null;

let lastScores = {};

// 🎨 TEAM COLORS
function getTeamColor(team) {
  const colors = {
    ANA: 0xF47A38,
    BOS: 0xFFB81C,
    BUF: 0x003087,
    CAR: 0xCC0000,
    CBJ: 0x002654,
    CGY: 0xC8102E,
    CHI: 0xCF0A2C,
    COL: 0x6F263D,
    DAL: 0x006847,
    DET: 0xCE1126,
    EDM: 0xFF4C00,
    FLA: 0xC8102E,
    LAK: 0x111111,
    MIN: 0x154734,
    MTL: 0xAF1E2D,
    NJD: 0xCE1126,
    NSH: 0xFFB81C,
    NYI: 0x00539B,
    NYR: 0x0038A8,
    OTT: 0xC52032,
    PHI: 0xF74902,
    PIT: 0xFCB514,
    SEA: 0x001628,
    SJS: 0x006D75,
    STL: 0x002F87,
    TBL: 0x002868,
    TOR: 0x00205B,
    VAN: 0x00205B,
    VGK: 0xB4975A,
    WPG: 0x041E42,
    WSH: 0x041E42,
    default: 0x00AAFF
  };

  return colors[team] || colors.default;
}

// 🏒 TEAM LOGOS
function getTeamLogo(team) {
  return `https://assets.nhle.com/logos/nhl/svg/${team}_light.svg`;
}

// 🔗 GAMECENTER LINK
function getGameLink(id) {
  return `https://www.nhl.com/gamecenter/${id}`;
}

// 📊 WIN PROBABILITY
function getWinProbability(game) {

  const hs = game.homeTeam.score || 0;
  const as = game.awayTeam.score || 0;

  const shotsH = game.homeTeam.sog || 0;
  const shotsA = game.awayTeam.sog || 0;

  let home = 50;

  home += (hs - as) * 10;
  home += (shotsH - shotsA) * 1.2;

  home = Math.max(5, Math.min(95, home));

  return {
    home: Math.round(home),
    away: Math.round(100 - home)
  };
}

// 🏒 GET GAMES
async function getGames() {

  const date = new Date().toISOString().split("T")[0];

  const res = await axios.get(
    `https://api-web.nhle.com/v1/schedule/${date}`
  );

  return res.data.gameWeek?.[0]?.games || [];
}

// 🧱 CREATE LIVE MESSAGE
async function getOrCreateMessage(channel, game) {

  const id = game.id;

  if (liveMessages[id]) {
    return liveMessages[id];
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏒 ${game.awayTeam.abbrev} vs ${game.homeTeam.abbrev}`)
    .setURL(getGameLink(id))
    .setThumbnail(getTeamLogo(game.homeTeam.abbrev))
    .setColor(getTeamColor(game.homeTeam.abbrev))
    .setDescription("Chargement...")
    .setFooter({
      text: "NHL Live Center"
    })
    .setTimestamp();

  const msg = await channel.send({
    embeds: [embed]
  });

  liveMessages[id] = msg;

  return msg;
}

// 🔴 LIVE MATCHES
async function updateLiveMatches() {

  try {

    const channel = await client.channels.fetch(
      CHANNELS.live
    );

    const games = await getGames();

    for (const g of games) {

      if (
        g.gameState !== "LIVE" &&
        g.gameState !== "FINAL"
      ) continue;

      const id = g.id;

      const home = g.homeTeam.abbrev;
      const away = g.awayTeam.abbrev;

      const hs = g.homeTeam.score || 0;
      const as = g.awayTeam.score || 0;

      const period =
        g.periodDescriptor?.number || 1;

      const clock =
        g.clock?.timeRemaining || "20:00";

      const prob = getWinProbability(g);

      const embed = new EmbedBuilder()
        .setTitle(`🏒 ${away} vs ${home}`)
        .setURL(getGameLink(id))
        .setThumbnail(getTeamLogo(home))
        .setFooter({
          text: "NHL Live Center"
        })
        .setTimestamp();

      // 🎨 DYNAMIC COLORS
      if (hs > as) {
        embed.setColor(0x00cc66);
      } else if (as > hs) {
        embed.setColor(0xff3333);
      } else {
        embed.setColor(0xffcc00);
      }

      embed.setDescription(
        `🔴 LIVE\n\n` +
        `${away} ${as} - ${hs} ${home}\n\n` +
        `📊 ${home}: ${prob.home}% | ${away}: ${prob.away}%\n` +
        `⏱️ P${period} • ${clock}`
      );

      // 🚨 GOAL ALERT
      const scoreKey = `${as}-${hs}`;

      if (
        lastScores[id] &&
        lastScores[id] !== scoreKey
      ) {
        await channel.send(
          `🚨 BUT ! ${away} ${as} - ${hs} ${home}`
        );
      }

      lastScores[id] = scoreKey;

      const msg = await getOrCreateMessage(
        channel,
        g
      );

      await msg.edit({
        embeds: [embed]
      });
    }

  } catch (err) {
    console.log(err);
  }
}

// 🏆 NHL STANDINGS
async function sendStandings() {

  try {

    const channel = await client.channels.fetch(
      CHANNELS.standings
    );

    const res = await axios.get(
      "https://api-web.nhle.com/v1/standings/now"
    );

    const standings = res.data.standings;

    const east = standings
      .filter(t => t.conferenceName === "Eastern")
      .sort((a, b) => b.points - a.points);

    const west = standings
      .filter(t => t.conferenceName === "Western")
      .sort((a, b) => b.points - a.points);

    const embed = new EmbedBuilder()
      .setTitle("🏆 NHL STANDINGS")
      .setThumbnail(
        "https://upload.wikimedia.org/wikipedia/en/3/3a/05_NHL_Shield.svg"
      )
      .setColor(0x0099ff)
      .setFooter({
        text: "NHL Standings"
      })
      .setTimestamp();

    let eastText = "";
    let westText = "";

    east.slice(0, 16).forEach((t, i) => {

      let clinch = "";

      if (i === 0) clinch = "z";
      else if (i <= 7) clinch = "x";

      eastText +=
        `**${i + 1}. ${clinch} ${t.teamAbbrev.default}**\n` +
        `${t.points} PTS • ${t.wins}-${t.losses}-${t.otLosses}\n` +
        `🔥 ${t.streakCode}\n\n`;
    });

    west.slice(0, 16).forEach((t, i) => {

      let clinch = "";

      if (i === 0) clinch = "z";
      else if (i <= 7) clinch = "x";

      westText +=
        `**${i + 1}. ${clinch} ${t.teamAbbrev.default}**\n` +
        `${t.points} PTS • ${t.wins}-${t.losses}-${t.otLosses}\n` +
        `🔥 ${t.streakCode}\n\n`;
    });

    embed.addFields(
      {
        name: "🌎 EASTERN",
        value: eastText,
        inline: true
      },
      {
        name: "🌎 WESTERN",
        value: westText,
        inline: true
      }
    );

    embed.setDescription(
      "📖 x = Playoff Spot • z = Conference Leader"
    );

    if (!standingsMessage) {

      standingsMessage = await channel.send({
        embeds: [embed]
      });

    } else {

      await standingsMessage.edit({
        embeds: [embed]
      });
    }

  } catch (err) {
    console.log(err);
  }
}

// ⭐ TOP PLAYERS
async function sendTopPlayers() {

  try {

    const channel = await client.channels.fetch(
      CHANNELS.players
    );

    const res = await axios.get(
      "https://api-web.nhle.com/v1/skater-stats-leaders/current"
    );

    const players =
      res.data.pointsLeaders.slice(0, 10);

    const embed = new EmbedBuilder()
      .setTitle("⭐ NHL TOP PLAYERS")
      .setThumbnail(
        getTeamLogo(players[0].teamAbbrev)
      )
      .setColor(0xffd700)
      .setFooter({
        text: "NHL Top Players"
      })
      .setTimestamp();

    let desc = "";

    players.forEach((p, i) => {

      desc +=
        `**${i + 1}. ${p.firstName.default} ${p.lastName.default}**\n` +
        `🏒 ${p.teamAbbrev}\n` +
        `📊 ${p.value} points\n\n`;
    });

    embed.setDescription(desc);

    if (!playersMessage) {

      playersMessage = await channel.send({
        embeds: [embed]
      });

    } else {

      await playersMessage.edit({
        embeds: [embed]
      });
    }

  } catch (err) {
    console.log(err);
  }
}

// 🏆 PLAYOFF BRACKET
async function sendPlayoffBracket() {

  try {

    const channel = await client.channels.fetch(
      CHANNELS.playoffs
    );

    const res = await axios.get(
      "https://api-web.nhle.com/v1/standings/now"
    );

    const standings = res.data.standings;

    const east = standings
      .filter(t => t.conferenceName === "Eastern")
      .sort((a, b) => b.points - a.points)
      .slice(0, 8);

    const west = standings
      .filter(t => t.conferenceName === "Western")
      .sort((a, b) => b.points - a.points)
      .slice(0, 8);

    const embed = new EmbedBuilder()
      .setTitle("🏆 NHL PLAYOFF BRACKET")
      .setColor(0xff9900)
      .setThumbnail(
        "https://upload.wikimedia.org/wikipedia/en/3/3a/05_NHL_Shield.svg"
      )
      .setFooter({
        text: "NHL Playoffs"
      })
      .setTimestamp();

    const desc = `
🏆 EASTERN

${east[0].teamAbbrev.default} ─┐
              ├── TBD
${east[7].teamAbbrev.default} ─┘

${east[1].teamAbbrev.default} ─┐
              ├── TBD
${east[6].teamAbbrev.default} ─┘

${east[2].teamAbbrev.default} ─┐
              ├── TBD
${east[5].teamAbbrev.default} ─┘

${east[3].teamAbbrev.default} ─┐
              ├── TBD
${east[4].teamAbbrev.default} ─┘


🌎 WESTERN

${west[0].teamAbbrev.default} ─┐
              ├── TBD
${west[7].teamAbbrev.default} ─┘

${west[1].teamAbbrev.default} ─┐
              ├── TBD
${west[6].teamAbbrev.default} ─┘

${west[2].teamAbbrev.default} ─┐
              ├── TBD
${west[5].teamAbbrev.default} ─┘

${west[3].teamAbbrev.default} ─┐
              ├── TBD
${west[4].teamAbbrev.default} ─┘
`;

    embed.setDescription(desc);

    if (!playoffsMessage) {

      playoffsMessage = await channel.send({
        embeds: [embed]
      });

    } else {

      await playoffsMessage.edit({
        embeds: [embed]
      });
    }

  } catch (err) {
    console.log(err);
  }
}

// ✅ BOT READY
client.once("clientReady", () => {

  console.log(`✅ Bot connecté: ${client.user.tag}`);

  // 🚀 START
  updateLiveMatches();
  sendStandings();
  sendTopPlayers();
  sendPlayoffBracket();

  // 🔴 LIVE
  setInterval(updateLiveMatches, 30000);

  // 🏆 STATS
  setInterval(sendStandings, 3600000);

  // ⭐ PLAYERS
  setInterval(sendTopPlayers, 3600000);

  // 🏆 PLAYOFFS
  setInterval(sendPlayoffBracket, 3600000);
});

// 🔑 LOGIN
client.login(TOKEN);
