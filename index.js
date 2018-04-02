const Discord = require("discord.js");
const bot = new Discord.Client();
const ytdl = require("ytdl-core");
const YouTube = require("simple-youtube-api");

const request = require("request");
const fs = require("fs");
const getYoutubeID = require("get-youtube-id");
const fetchVideoInfo = require("youtube-info");
//CONFIG
const config = require("./config.json");
const prefix = config.prefix;
const color = config.color;

const keys = require("./keys.json");
const token = keys.token;
const yt_api_key = keys.yt_api_key;

const youtube = new YouTube(yt_api_key);

//Sona sounds
const ultpath = "/Desktop - HDD/sona.mp3"

let queue = new Map();

let dispatcher;

bot.on("ready", async () => {
  console.log("SonaBot is up and running!");
  bot.user.setUsername("SonaBot");
  bot.user.setActivity(" jingles!", {type: "PLAYING"});
});

bot.on("disconnect", async() => {
  console.log("BRB, going back to base!");
});

bot.on("reconnecting", async() =>{
  console.log("Coming back to lane!");
});

bot.on("message", async message => {
  if (message.author.bot) return;
  if(!message.content.startsWith(prefix)) return;
  let args = message.content.split(" ").splice(1);
  let serverQueue = queue.get(message.guild.id);

  if (message.content.startsWith(`${prefix}play`)){
    let voiceChannel = message.member.voiceChannel;
    if (!voiceChannel) return message.channel.send("You must be in a voice channel to use this bot!");
    let permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT")) return message.channel.send("Inadequate permissions for me!");
    if (!permissions.has("SPEAK")) return message.channel.send("Inadequate permissions for me!");
    try {
      var video = await youtube.getVideo(args[0]);
    } catch(err){
      try {
        var searchname = args.join(" ");
        let videos = await youtube.searchVideos(searchname, 1);
        video = await youtube.getVideoByID(videos[0].id);
      } catch(error) {
        console.log(error);
        return message.channel.send("Could not find any videos!");
      }
    }

    const song = {
      id: video.id,
      title: video.title,
      url: `https://www.youtube.com/watch?v=${video.id}`
    };

    if (!serverQueue) {
      const queueConstruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        dispatcher: null,
        songs: [],
        volume: 1,
        playing: true
      };
      queue.set(message.guild.id, queueConstruct);
      queueConstruct.songs.push(song);
      connection = await voiceChannel.join().catch(err => {
        message.channel.send(`Error: ${err}`);
        queue.delete(message.guild.id);
        return;
      });
      queueConstruct.connection = connection;
      play(message.guild, queueConstruct.songs[0]);
    } else {
      serverQueue.songs.push(song);
      return message.channel.send(`Added ${song.title} to the queue`);
    }
  } else if (message.content.startsWith(`${prefix}pause`)) {
    const serverQueue = queue.get(message.guild.id);
    if (!message.member.voiceChannel) return message.channel.send("You must be in a voice channel to use this bot!");
    if (!serverQueue) return message.channel.send("Nothing is playing right now!");
    if (!serverQueue.dispatcher.paused){
      serverQueue.dispatcher.pause();
      return message.channel.send("Paused playing!");
    } else {
      return message.channel.send("Nothing is playing right now!");
    }
  } else if (message.content.startsWith(`${prefix}resume`)) {
    if (!message.member.voiceChannel) return message.channel.send("You must be in a voice channel to use this bot!");
    if (!serverQueue) return message.channel.send("Nothing is playing right now!");
    if (serverQueue.dispatcher.paused){
      serverQueue.dispatcher.resume();
      return message.channel.send("Resumed playing!")
    } else {
      return message.channel.send("Something is already playing!");
    }
  } else if (message.content.startsWith(`${prefix}volume`)) {
    if (!message.member.voiceChannel) return message.channel.send("You must be in a voice channel to use this bot!");
    if (!serverQueue) return message.channel.send("Nothing is playing right now!");
    if (!args[0]) return message.channel.send(`The current volume is ${serverQueue.volume}`);
    serverQueue.dispatcher.setVolumeLogarithmic(args[0]);
    return message.channel.send(`Set the volume to ${args[0]}`);
  } else if (message.content.startsWith(`${prefix}skip`)) {
    if (!message.member.voiceChannel) return message.channel.send("You must be in a voice channel to use this bot!");
    if (!serverQueue) return message.channel.send("Nothing is playing right now!");
    serverQueue.dispatcher.end();
    return message.channel.send("Skipped song!")
  } else if (message.content.startsWith(`${prefix}stop`)) {
    if (!message.member.voiceChannel) return message.channel.send("You must be in a voice channel to use this bot!");
    if (!serverQueue) return message.channel.send("Nothing is playing right now!");
    serverQueue.songs = [];
    serverQueue.dispatcher.end();
    return message.channel.send("Stopped and cleared queue!");
  } else if (message.content.startsWith(`${prefix}np`)) {
    if (!serverQueue) return message.channel.send("Nothing is playing right now!");
    return message.channel.send(`Currently playing: ${serverQueue.songs[0].title}`);
  } else if (message.content.startsWith(`${prefix}queue`)){
    if (!serverQueue) return message.channel.send("Nothing is playing right now!");
    let embedqueue = new Discord.RichEmbed()
    .setTitle("__**Song Queue**__")
    .setDescription("Songs currently in queue")
    .setColor(color);
    for (i = 0; i < serverQueue.songs.length; i++){
      embedqueue.addField(`${i + 1}.`,`${serverQueue.songs[i].title}`);
    }
    return message.channel.send(embedqueue);
  }
});

bot.login(token);


//ALL YOUTUBE/MUSIC FUNCTIONS HERE
function play(guild, song){
  const serverQueue = queue.get(guild.id);

  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  serverQueue.textChannel.send(`Now playing ${song.title}`);
  serverQueue.dispatcher = serverQueue.connection.playStream(ytdl(song.url), {
    filter: "audioonly",
    quality: "highestaudio"
  })
  .on("end", async() => {
    if (serverQueue.songs.length > 0){
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0])
    } else {
      serverQueue.voiceChannel.leave();
    }
  })
  .on("error", (err) => serverQueue.textChannel.send(`Error: ${err}`));
  serverQueue.dispatcher.setVolumeLogarithmic(serverQueue.volume);
}
