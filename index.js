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

// 🔐 VARIABLES
const TOKEN = process.env.TOKEN;

const CHANNELS = {
  live: process.env.CHANNEL_LIVE,
  standings: process.env.CHANNEL_STANDINGS,
  players: process.env.CHANNEL_PLAYERS,
  playoffs: process.env.CHANNEL_PLAYOFFS
};

// 🧠 STOCKAGE
let liveMessages = {};
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
  const logos = {
    ANA: "https://assets.nhle.com/logos/nhl/svg/ANA_light.svg",
    BOS: "https://assets.nhle.com/logos/nhl/svg/BOS_light.svg",
    BUF: "https://assets.nhle.com/logos/nhl/svg/BUF_light.svg",
    CAR: "https://assets.nhle.com/logos/nhl/svg/CAR_light.svg",
    CBJ: "https://assets.nhle.com/logos/nhl/svg/CBJ_light.svg",
    CGY: "https://assets.nhle.com/logos/nhl/svg/CGY_light.svg",
    CHI: "https://assets.nhle.com/logos/nhl/svg/CHI_light.svg",
    COL: "https://assets.nhle.com/logos/nhl/svg/COL_light.svg",
    DAL: "https://assets.nhle.com/logos/nhl/svg/DAL_light.svg",
    DET: "https://assets.nhle.com/logos/nhl/svg/DET_light.svg",
    EDM: "https://assets.nhle.com/logos/nhl/svg/EDM_light.svg",
    FLA: "https://assets.nhle.com/logos/nhl/svg/FLA_light.svg",
    LAK: "https://assets.nhle.com/logos/nhl/svg/LAK_light.svg",
    MIN: "https://assets.nhle.com/logos/nhl/svg/MIN_light.svg",
    MTL: "https://assets.nhle.com/logos/nhl/svg/MTL_light.svg",
    NJD: "https://assets.nhle.com/logos/nhl/svg/NJD_light.svg",
    NSH: "https://assets.nhle.com/logos/nhl/svg/NSH_light.svg",
    NYI: "https://assets.nhle.com/logos/nhl/svg/NYI_light.svg",
    NYR: "https://assets.nhle.com/logos/nhl/svg/NYR_light.svg",
    OTT: "https://assets.nhle.com/logos/nhl/svg/OTT_light.svg",
    PHI: "https://assets.nhle.com/logos/nhl/svg/PHI_light.svg",
    PIT: "https://assets.nhle.com/logos/nhl/svg/PIT_light.svg",
    SEA: "https://assets.nhle.com/logos/nhl/svg/SEA_light.svg",
    SJS: "https://assets.nhle.com/logos/nhl/svg/SJS_light.svg",
    STL: "https://assets.nhle.com/logos/nhl/svg/STL_light.svg",
    TBL: "https://assets.nhle.com/logos/nhl/svg/TBL_light.svg",
    TOR: "https://assets.nhle.com/logos/nhl/svg/TOR_light.svg",
    VAN: "https://assets.nhle.com/logos/nhl/svg/VAN_light.svg",
    VGK: "https://assets.nhle.com/logos/nhl/svg/VGK_light.svg",
    WPG: "https://assets.nhle.com/logos/nhl/svg/WPG_light.svg",
    WSH: "https://assets.nhle.com/logos/nhl/svg/WSH_light.svg"
  };

  return logos[team];
}

// 🔗 GAMECENTER
function getGameLink(id) {
  return `https://www.nhl.com/gamecenter/${id}`;
}

// 📊 PROBABILITÉ
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

// 🧱 CREATE MESSAGE
async function getOrCreateMessage(channel, game) {
  const id = game.id;

  if (liveMessages[id]) {
    return liveMessages[id];
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏒 ${game.awayTeam.abbrev} vs ${game.homeTeam.abbrev}`)
    .setURL(getGameLink(id))
    .setThumbnail(getTeamLogo(game.homeTeam.abbrev))
    .setDescription("Chargement...")
    .setColor(getTeamColor(game.homeTeam.abbrev))
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
        `⏱️ P${period} - ${clock}`
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

    const divisions = {};
    const conferences = {};

    for (const team of standings) {

      const div = team.divisionName;

      if (!divisions[div]) {
        divisions[div] = [];
      }

      divisions[div].push(team);

      const conf = team.conferenceName;

      if (!conferences[conf]) {
        conferences[conf] = [];
      }

      conferences[conf].push(team);
    }

    // 🏆 DIVISIONS
    for (const div in divisions) {

      const embed = new EmbedBuilder()
        .setTitle(`🏆 ${div.toUpperCase()} DIVISION`)
        .setThumbnail(
          "https://upload.wikimedia.org/wikipedia/en/3/3a/05_NHL_Shield.svg"
        )
        .setColor(0x0099ff)
        .setFooter({
          text: "NHL Standings"
        })
        .setTimestamp();

      let desc = "";

      divisions[div]
        .sort((a, b) => b.points - a.points)
        .slice(0, 8)
        .forEach((t, i) => {

          let clinch = "";

          if (i === 0) clinch = "y";
          if (t.clinchIndicator === "x") clinch = "x";
          if (t.clinchIndicator === "z") clinch = "z";

          desc +=
            `**${i + 1}. ${clinch} ${t.teamName.default}**\n` +
            `🏆 ${t.points} PTS\n` +
            `📊 ${t.wins}-${t.losses}-${t.otLosses}\n` +
            `🔥 ${t.streakCode}\n\n`;
        });

      desc +=
`\n📖 LEGEND
x = Playoff spot
y = Division champion
z = Conference leader`;

      embed.setDescription(desc);

      await channel.send({
        embeds: [embed]
      });
    }

    // 🌎 CONFERENCES
    for (const conf in conferences) {

      const embed = new EmbedBuilder()
        .setTitle(`🌎 ${conf.toUpperCase()} CONFERENCE`)
        .setThumbnail(
          "https://upload.wikimedia.org/wikipedia/en/3/3a/05_NHL_Shield.svg"
        )
        .setColor(0x00cc99)
        .setFooter({
          text: "NHL Conference Standings"
        })
        .setTimestamp();

      let desc = "";

      conferences[conf]
        .sort((a, b) => b.points - a.points)
        .slice(0, 16)
        .forEach((t, i) => {

          let clinch = "";

          if (i === 0) clinch = "z";
          else if (i <= 7) clinch = "x";

          desc +=
            `**${i + 1}. ${clinch} ${t.teamName.default}**\n` +
            `🏆 ${t.points} PTS\n` +
            `📊 ${t.wins}-${t.losses}-${t.otLosses}\n` +
            `🔥 ${t.streakCode}\n\n`;
        });

      embed.setDescription(desc);

      await channel.send({
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
      .setTitle("⭐ TOP POINTEURS NHL")
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

    await channel.send({
      embeds: [embed]
    });

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
      .setThumbnail(
        "https://upload.wikimedia.org/wikipedia/en/3/3a/05_NHL_Shield.svg"
      )
      .setColor(0xff9900)
      .setFooter({
        text: "NHL Playoffs"
      })
      .setTimestamp();

    let desc = "🌎 EASTERN\n\n";

    desc +=
`${east[0].teamAbbrev.default} vs ${east[7].teamAbbrev.default}
${east[1].teamAbbrev.default} vs ${east[6].teamAbbrev.default}
${east[2].teamAbbrev.default} vs ${east[5].teamAbbrev.default}
${east[3].teamAbbrev.default} vs ${east[4].teamAbbrev.default}

`;

    desc += "🌎 WESTERN\n\n";

    desc +=
`${west[0].teamAbbrev.default} vs ${west[7].teamAbbrev.default}
${west[1].teamAbbrev.default} vs ${west[6].teamAbbrev.default}
${west[2].teamAbbrev.default} vs ${west[5].teamAbbrev.default}
${west[3].teamAbbrev.default} vs ${west[4].teamAbbrev.default}`;

    embed.setDescription(desc);

    await channel.send({
      embeds: [embed]
    });

  } catch (err) {
    console.log(err);
  }
}

// ✅ READY
client.once("clientReady", () => {

  console.log(`✅ Bot connecté: ${client.user.tag}`);

  updateLiveMatches();
  sendStandings();
  sendTopPlayers();
  sendPlayoffBracket();

  setInterval(updateLiveMatches, 30000);

  setInterval(sendStandings, 3600000);

  setInterval(sendTopPlayers, 3600000);

  setInterval(sendPlayoffBracket, 3600000);
});

// 🔑 LOGIN
client.login(TOKEN);
