const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;

const CHANNELS = {
  live: process.env.CHANNEL_LIVE,
  standings: process.env.CHANNEL_STANDINGS,
  players: process.env.CHANNEL_PLAYERS
};

let liveMessages = {};
let lastScores = {};

// 🔥 BOT READY
client.once("ready", () => {
  console.log(`✅ Bot connecté: ${client.user.tag}`);

  setInterval(updateLiveMatches, 30000);
  setInterval(sendStandings, 3600000);
  setInterval(sendTopPlayers, 3600000);
});

// 🏒 MATCHS
async function getGames() {
  const date = new Date().toISOString().split("T")[0];
  const res = await axios.get(`https://api-web.nhle.com/v1/schedule/${date}`);
  return res.data.gameWeek?.[0]?.games || [];
}

// 🎨 COULEURS TEAMS
function getTeamColor(team) {
  const colors = {
    MTL: 0xff0000,
    TOR: 0x00205b,
    BOS: 0xffb81c,
    EDM: 0xff4c00,
    VAN: 0x001f5b,
    default: 0x00ff00
  };
  return colors[team] || colors.default;
}

// 🔗 LINK NHL
function getGameLink(id) {
  return `https://www.nhl.com/gamecenter/${id}`;
}

// 🧠 PROBABILITÉ INTELLIGENTE
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

// 🧱 CREATE LIVE MESSAGE PAR MATCH
async function getOrCreateMessage(channel, game) {
  const id = game.id;

  if (liveMessages[id]) return liveMessages[id];

  const embed = new EmbedBuilder()
    .setTitle(`🏒 ${game.awayTeam.abbrev} vs ${game.homeTeam.abbrev}`)
    .setURL(getGameLink(id))
    .setDescription("Chargement...")
    .setColor(getTeamColor(game.homeTeam.abbrev));

  const msg = await channel.send({ embeds: [embed] });

  liveMessages[id] = msg;
  return msg;
}

// 🔴 LIVE UPDATE
async function updateLiveMatches() {
  const channel = await client.channels.fetch(CHANNELS.live);
  const games = await getGames();

  for (const g of games) {
    if (g.gameState !== "LIVE" && g.gameState !== "FINAL") continue;

    const id = g.id;
    const home = g.homeTeam.abbrev;
    const away = g.awayTeam.abbrev;

    const hs = g.homeTeam.score || 0;
    const as = g.awayTeam.score || 0;

    const period = g.periodDescriptor?.number || 1;
    const clock = g.clock?.timeRemaining || "20:00";

    const prob = getWinProbability(g);

    const embed = new EmbedBuilder()
      .setTitle(`🏒 ${away} vs ${home}`)
      .setURL(getGameLink(id))
      .setColor(getTeamColor(home))
      .setDescription(
        `🔴 LIVE\n\n` +
        `${away} ${as} - ${hs} ${home}\n` +
        `📊 ${home}: ${prob.home}% | ${away}: ${prob.away}%\n` +
        `⏱️ P${period} - ${clock}`
      );

    // 🚨 BUT
    const scoreKey = `${as}-${hs}`;
    if (lastScores[id] && lastScores[id] !== scoreKey) {
      channel.send(`🚨 BUT ! ${away} ${as} - ${hs} ${home}`);
    }
    lastScores[id] = scoreKey;

    const msg = await getOrCreateMessage(channel, g);
    await msg.edit({ embeds: [embed] });
  }
}

// 🏆 CLASSEMENT PAR DIVISION
async function sendStandings() {
  const channel = await client.channels.fetch(CHANNELS.standings);

  const res = await axios.get("https://api-web.nhle.com/v1/standings/now");
  const standings = res.data.standings;

  const divisions = {};

  for (const team of standings) {
    const div = team.divisionName || "Unknown";
    if (!divisions[div]) divisions[div] = [];
    divisions[div].push(team);
  }

  let text = "🏆 CLASSEMENT NHL\n\n";

  for (const div in divisions) {
    text += `🔥 ${div}\n`;

    divisions[div].slice(0, 5).forEach((t, i) => {
      text += `${i + 1}. ${t.teamAbbrev.default} - ${t.points} pts\n`;
    });

    text += "\n";
  }

  channel.send(text);
}

// ⭐ TOP JOUEURS
async function sendTopPlayers() {
  const channel = await client.channels.fetch(CHANNELS.players);

  const res = await axios.get("https://api-web.nhle.com/v1/skater-stats-leaders/current");
  const players = res.data.skaterGoalLeaders.slice(0, 5);

  let text = "⭐ TOP JOUEURS NHL\n\n";

  players.forEach((p, i) => {
    text += `${i + 1}. ${p.firstName.default} ${p.lastName.default} - ${p.value} buts\n`;
  });

  channel.send(text);
}

client.login(TOKEN);
