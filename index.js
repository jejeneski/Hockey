const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");
const express = require("express");

const app = express();

// 🌐 KEEP ALIVE
app.get("/", (req, res) => {
  res.send("🏒 NHL BOT ONLINE");
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
  playoffs: process.env.CHANNEL_PLAYOFFS,
  news: process.env.CHANNEL_NEWS
};

// 🧠 STORAGE
let liveMessages = {};
let standingsMessage = null;
let playersMessage = null;
let playoffsMessage = null;

let lastScores = {};
let sentNews = [];

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

// 🏒 TEAM LOGO
function getTeamLogo(team) {
  return `https://assets.nhle.com/logos/nhl/svg/${team}_light.svg`;
}

// 🔗 GAMECENTER
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

// 🏒 TODAY GAMES
async function getGames() {

  const date = new Date()
    .toISOString()
    .split("T")[0];

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
    .setColor(getTeamColor(game.homeTeam.abbrev))
    .setThumbnail(
      getTeamLogo(game.homeTeam.abbrev)
    )
    .setDescription("Loading...")
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

// 🔴 LIVE GAMES
async function updateLiveMatches() {

  try {

    const channel = await client.channels.fetch(
      CHANNELS.live
    );

    const games = await getGames();

    for (const g of games) {

      const id = g.id;

      const home = g.homeTeam.abbrev;
      const away = g.awayTeam.abbrev;

      const hs = g.homeTeam.score || 0;
      const as = g.awayTeam.score || 0;

      const shotsH = g.homeTeam.sog || 0;
      const shotsA = g.awayTeam.sog || 0;

      const period =
        g.periodDescriptor?.number || 1;

      const clock =
        g.clock?.timeRemaining || "20:00";

      const startTime = new Date(
        g.startTimeUTC
      ).toLocaleTimeString("fr-CA", {
        hour: "2-digit",
        minute: "2-digit"
      });

      const prob = getWinProbability(g);

      let embed = new EmbedBuilder()
        .setTitle(`🏒 ${away} vs ${home}`)
        .setURL(getGameLink(id))
        .setThumbnail(getTeamLogo(home))
        .setFooter({
          text: "NHL Live Center"
        })
        .setTimestamp();

      // 🟦 PRE GAME
      if (g.gameState === "PRE") {

        embed
          .setColor(0x0099ff)
          .setDescription(
            `🟦 MATCH DU JOUR\n\n` +
            `🕒 ${startTime}\n\n` +
            `📊 ${home}: ${prob.home}%\n` +
            `📊 ${away}: ${prob.away}%\n\n` +
            `🏒 ${away} vs ${home}`
          );
      }

      // 🔴 LIVE
      else if (g.gameState === "LIVE") {

        if (hs > as) {
          embed.setColor(0x00cc66);
        }

        else if (as > hs) {
          embed.setColor(0xff3333);
        }

        else {
          embed.setColor(0xffcc00);
        }

        embed.setDescription(
          `🔴 LIVE\n\n` +
          `${away} ${as} - ${hs} ${home}\n\n` +
          `⏱️ P${period} • ${clock}\n\n` +
          `📊 ${home}: ${prob.home}%\n` +
          `📊 ${away}: ${prob.away}%\n\n` +
          `🥅 Shots: ${shotsA}-${shotsH}`
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
      }

      // ⚫ FINAL
      else if (g.gameState === "FINAL") {

        embed
          .setColor(0x666666)
          .setDescription(
            `⚫ FINAL\n\n` +
            `${away} ${as} - ${hs} ${home}\n\n` +
            `🥅 Shots: ${shotsA}-${shotsH}`
          );
      }

      else {
        continue;
      }

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

// 🏆 STANDINGS
async function sendStandings() {

  try {

    const channel = await client.channels.fetch(
      CHANNELS.standings
    );

    const res = await axios.get(
      "https://api-web.nhle.com/v1/standings/now"
    );

    const standings = res.data.standings;

    const atlantic = standings
      .filter(t => t.divisionName === "Atlantic")
      .sort((a, b) => b.points - a.points);

    const metro = standings
      .filter(t => t.divisionName === "Metropolitan")
      .sort((a, b) => b.points - a.points);

    const central = standings
      .filter(t => t.divisionName === "Central")
      .sort((a, b) => b.points - a.points);

    const pacific = standings
      .filter(t => t.divisionName === "Pacific")
      .sort((a, b) => b.points - a.points);

    const embed = new EmbedBuilder()
      .setTitle("🏆 NHL STANDINGS")
      .setColor(0x0099ff)
      .setFooter({
        text: "Updated Live"
      })
      .setTimestamp();

    function formatDivision(teams) {

      let txt = "";

      teams.slice(0, 8).forEach((t, i) => {

        txt +=
          `**${i + 1}. ${t.teamAbbrev.default}** • ${t.points}PTS\n` +
          `${t.wins}-${t.losses}-${t.otLosses} • ${t.streakCode}\n\n`;
      });

      return txt;
    }

    embed.addFields(
      {
        name: "🌊 Atlantic",
        value: formatDivision(atlantic),
        inline: true
      },
      {
        name: "🏙️ Metro",
        value: formatDivision(metro),
        inline: true
      },
      {
        name: "🌽 Central",
        value: formatDivision(central),
        inline: true
      },
      {
        name: "🌴 Pacific",
        value: formatDivision(pacific),
        inline: true
      }
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
      .setColor(0xffd700)
      .setThumbnail(
        getTeamLogo(players[0].teamAbbrev)
      )
      .setFooter({
        text: "Top Points"
      })
      .setTimestamp();

    let desc = "";

    players.forEach((p, i) => {

      desc +=
        `**${i + 1}. ${p.firstName.default} ${p.lastName.default}**\n` +
        `${p.teamAbbrev} • ${p.value} points\n\n`;
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
      .setTitle("🏆 NHL PLAYOFF RACE")
      .setColor(0xff9900)
      .setFooter({
        text: "TheScore Style"
      })
      .setTimestamp();

    const desc = `
🌎 EASTERN

${east[0].teamAbbrev.default} ──┐
               ├───────
${east[7].teamAbbrev.default} ──┘

${east[1].teamAbbrev.default} ──┐
               ├───────
${east[6].teamAbbrev.default} ──┘

${east[2].teamAbbrev.default} ──┐
               ├───────
${east[5].teamAbbrev.default} ──┘

${east[3].teamAbbrev.default} ──┐
               ├───────
${east[4].teamAbbrev.default} ──┘


🌎 WESTERN

${west[0].teamAbbrev.default} ──┐
               ├───────
${west[7].teamAbbrev.default} ──┘

${west[1].teamAbbrev.default} ──┐
               ├───────
${west[6].teamAbbrev.default} ──┘

${west[2].teamAbbrev.default} ──┐
               ├───────
${west[5].teamAbbrev.default} ──┘

${west[3].teamAbbrev.default} ──┐
               ├───────
${west[4].teamAbbrev.default} ──┘
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

// 📰 NHL NEWS
async function sendNews() {

  try {

    const channel = await client.channels.fetch(
      CHANNELS.news
    );

    const res = await axios.get(
      "https://api-web.nhle.com/v1/news/now"
    );

    const articles = res.data.articles || [];

    for (const article of articles.slice(0, 5)) {

      if (sentNews.includes(article.id)) {
        continue;
      }

      sentNews.push(article.id);

      const embed = new EmbedBuilder()
        .setTitle(`📰 ${article.headline}`)
        .setURL(article.url)
        .setDescription(
          article.subhead || "NHL News"
        )
        .setColor(0x00ccff)
        .setTimestamp();

      if (article.image?.cuts?.[0]?.src) {
        embed.setImage(
          article.image.cuts[0].src
        );
      }

      await channel.send({
        embeds: [embed]
      });
    }

  } catch (err) {
    console.log(err);
  }
}

// ✅ READY
client.once("clientReady", () => {

  console.log(`✅ Logged in as ${client.user.tag}`);

  // 🚀 START
  updateLiveMatches();
  sendStandings();
  sendTopPlayers();
  sendPlayoffBracket();
  sendNews();

  // 🔄 AUTO UPDATE
  setInterval(updateLiveMatches, 30000);

  setInterval(sendStandings, 3600000);

  setInterval(sendTopPlayers, 3600000);

  setInterval(sendPlayoffBracket, 3600000);

  setInterval(sendNews, 900000);
});

// 🔑 LOGIN
client.login(TOKEN);
